import { db } from '../../../../core/backend/db';
import { ValidationError, NotFoundError, ConflictError, PermissionError } from '../../../../core/backend/errors';
import {
  RecordCustomerPaymentSchema, DepositAdvanceSchema, WriteOffSchema, CreditNoteSchema, UpdateCreditAccountSchema
} from '../../../../core/validation/customer_schemas';
import { logger } from '../../../../core/backend/logger';
import { authService } from '../../../auth/backend/service/auth_service';

export class CreditService {
  private getCurrentUserId(): number {
    return authService.getCurrentUserId() || 1;
  }

  public getCreditAccount(customerId: number) {
    let row = db.prepare('SELECT * FROM customer_credit_accounts WHERE customer_id = ?').get(customerId);
    if (!row) {
      // Seed default account settings
      const customer = db.prepare('SELECT credit_limit_paise FROM customers WHERE id = ?').get(customerId) as { credit_limit_paise: number } | undefined;
      if (!customer) throw new NotFoundError(`Customer with id ${customerId} not found`);
      
      const insert = db.prepare(`
        INSERT INTO customer_credit_accounts (
          customer_id, credit_limit_paise, soft_limit_paise, hard_limit_paise,
          grace_days, max_overdue_days, interest_rate_percent, is_frozen, is_blacklisted
        ) VALUES (?, ?, ?, ?, 7, 30, 0, 0, 0)
      `);
      const limit = customer.credit_limit_paise;
      insert.run(customerId, limit, Math.round(limit * 0.9), limit);
      row = db.prepare('SELECT * FROM customer_credit_accounts WHERE customer_id = ?').get(customerId);
    }
    return row;
  }

  public updateCreditAccount(customerId: number, rawInput: unknown) {
    const parsed = UpdateCreditAccountSchema.parse(rawInput);
    const userId = this.getCurrentUserId();

    db.transaction(() => {
      const sets: string[] = [];
      const values: any[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && key !== 'customer_id') {
          sets.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (sets.length > 0) {
        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(customerId);
        db.prepare(`UPDATE customer_credit_accounts SET ${sets.join(', ')} WHERE customer_id = ?`).run(...values);
      }

      // Sync customer table credit_limit_paise
      if (parsed.credit_limit_paise !== undefined) {
        db.prepare('UPDATE customers SET credit_limit_paise = ? WHERE id = ?').run(parsed.credit_limit_paise, customerId);
      }

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'update_credit_account', 'Credit account terms updated', ?)
      `).run(customerId, userId);
    })();

    return this.getCreditAccount(customerId);
  }

  public validateCreditSale(customerId: number, amountPaise: number, userId: number) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) {
      throw new NotFoundError(`Customer with id ${customerId} not found`);
    }

    if (customer.is_active === 0) {
      return { allowed: false, requiresOverride: false, message: 'Customer is inactive', outstanding_paise: customer.outstanding_balance_paise, credit_limit_paise: customer.credit_limit_paise, available_credit_paise: 0 };
    }

    if (customer.credit_allowed === 0) {
      return { allowed: false, requiresOverride: false, message: 'Credit purchases not enabled for this customer', outstanding_paise: customer.outstanding_balance_paise, credit_limit_paise: customer.credit_limit_paise, available_credit_paise: 0 };
    }

    const account = this.getCreditAccount(customerId) as any;
    if (account.is_frozen === 1) {
      return { allowed: false, requiresOverride: false, message: `Credit is frozen: ${account.freeze_reason || 'N/A'}`, outstanding_paise: customer.outstanding_balance_paise, credit_limit_paise: customer.credit_limit_paise, available_credit_paise: 0 };
    }

    if (account.is_blacklisted === 1) {
      return { allowed: false, requiresOverride: false, message: `Customer is blacklisted: ${account.blacklist_reason || 'N/A'}`, outstanding_paise: customer.outstanding_balance_paise, credit_limit_paise: customer.credit_limit_paise, available_credit_paise: 0 };
    }

    const currentOutstanding = customer.outstanding_balance_paise;
    const limit = account.credit_limit_paise;
    const newOutstanding = currentOutstanding + amountPaise;
    const available = limit - currentOutstanding;

    // Check overdue aging limit: find oldest unpaid invoice
    const oldestInvoice = db.prepare(`
      SELECT completed_at FROM invoices 
      WHERE customer_id = ? AND status = 'completed' AND payment_status IN ('unpaid', 'partial')
      ORDER BY completed_at ASC LIMIT 1
    `).get(customerId) as { completed_at: string } | undefined;

    if (oldestInvoice?.completed_at) {
      const days = Math.floor((Date.now() - new Date(oldestInvoice.completed_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days > account.max_overdue_days) {
        return {
          allowed: false,
          requiresOverride: false,
          message: `Credit blocked: customer has invoices overdue by ${days} days (max limit is ${account.max_overdue_days} days)`,
          outstanding_paise: currentOutstanding,
          credit_limit_paise: limit,
          available_credit_paise: available
        };
      }
    }

    if (newOutstanding > account.hard_limit_paise) {
      return {
        allowed: false,
        requiresOverride: false,
        message: `Credit transaction blocks: total outstanding (${(newOutstanding/100).toFixed(2)}) will exceed hard limit of (${(account.hard_limit_paise/100).toFixed(2)})`,
        outstanding_paise: currentOutstanding,
        credit_limit_paise: limit,
        available_credit_paise: available
      };
    }

    if (newOutstanding > account.soft_limit_paise) {
      return {
        allowed: true,
        requiresOverride: true,
        message: `Total outstanding will exceed soft warning limit of (${(account.soft_limit_paise/100).toFixed(2)}). Requires Manager approval.`,
        outstanding_paise: currentOutstanding,
        credit_limit_paise: limit,
        available_credit_paise: available
      };
    }

    return {
      allowed: true,
      requiresOverride: false,
      message: 'Approval OK',
      outstanding_paise: currentOutstanding,
      credit_limit_paise: limit,
      available_credit_paise: available
    };
  }

  public createCreditSale(invoiceId: number, customerId: number, amountPaise: number, invoiceNumber: string) {
    const userId = this.getCurrentUserId();

    db.transaction(() => {
      // 1. Get current balance
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const opening = last ? last.running_balance_paise : 0;
      const nextBalance = opening + amountPaise;

      // 2. Insert into Ledger
      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'invoice', ?, ?, ?, ?, 0, ?, ?)
      `).run(customerId, invoiceId, invoiceNumber, `Credit sale for invoice #${invoiceNumber}`, amountPaise, nextBalance, userId);

      // 3. Insert transaction log
      db.prepare(`
        INSERT INTO customer_credit_transactions (customer_id, invoice_id, transaction_type, amount_paise, reference_number, created_by)
        VALUES (?, ?, 'credit_sale', ?, ?, ?)
      `).run(customerId, invoiceId, amountPaise, invoiceNumber, userId);

      // 4. Update balances in customer profile
      db.prepare(`
        UPDATE customers 
        SET outstanding_balance_paise = outstanding_balance_paise + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amountPaise, customerId);

      // 5. Log activity
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'credit_sale', ?, ?)
      `).run(customerId, `Credit sale recorded of amount ₹${(amountPaise/100).toFixed(2)} on invoice #${invoiceNumber}`, userId);
    })();
  }

  public recordPayment(rawInput: unknown): any {
    const parsed = RecordCustomerPaymentSchema.parse(rawInput);
    const userId = this.getCurrentUserId();
    const customerId = parsed.customer_id;
    const paymentAmount = parsed.amount_paise;

    const result = db.transaction(() => {
      // 1. Log payment receipt
      const resPay = db.prepare(`
        INSERT INTO customer_payment_records (
          customer_id, amount_paise, method, reference_number, cheque_number, cheque_date, bank_name, payment_date, notes, is_advance, is_allocated, unallocated_paise, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, 0, 0, ?, ?)
      `).run(
        customerId, paymentAmount, parsed.method, parsed.reference_number ?? null,
        parsed.cheque_number ?? null, parsed.cheque_date ?? null, parsed.bank_name ?? null,
        parsed.payment_date ?? null, parsed.notes ?? null, paymentAmount, userId
      );

      const paymentId = resPay.lastInsertRowid as number;

      // 2. Fetch last running balance and update ledger
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const startBalance = last ? last.running_balance_paise : 0;
      const nextBalance = startBalance - paymentAmount;

      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'payment', ?, NULL, ?, 0, ?, ?, ?)
      `).run(customerId, paymentId, `Payment received via ${parsed.method.toUpperCase()}`, paymentAmount, nextBalance, userId);

      // 3. Log credit transaction
      db.prepare(`
        INSERT INTO customer_credit_transactions (customer_id, invoice_id, transaction_type, amount_paise, reference_number, created_by)
        VALUES (?, NULL, 'payment', ?, ?, ?)
      `).run(customerId, paymentAmount, parsed.reference_number ?? null, userId);

      // 4. FIFO Allocation to outstanding invoices
      // Find all completed invoices for customer that are unpaid/partial
      const unpaidInvoices = db.prepare(`
        SELECT id, invoice_number, total_paise, 
          (total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as remaining_paise
        FROM invoices
        WHERE customer_id = ? AND status = 'completed' AND payment_status IN ('unpaid', 'partial')
        ORDER BY completed_at ASC
      `).all(customerId) as { id: number; invoice_number: string; total_paise: number; remaining_paise: number }[];

      let remainingPayment = paymentAmount;
      const applied: { invoiceId: number; invoiceNumber: string; allocatedPaise: number }[] = [];

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;
        if (invoice.remaining_paise <= 0) continue;

        const allocate = Math.min(invoice.remaining_paise, remainingPayment);
        db.prepare(`
          INSERT INTO customer_payment_allocations (payment_id, invoice_id, allocated_paise)
          VALUES (?, ?, ?)
        `).run(paymentId, invoice.id, allocate);

        // Update invoice payment status
        const isPaid = (invoice.remaining_paise - allocate) <= 0;
        db.prepare(`
          UPDATE invoices 
          SET payment_status = ? 
          WHERE id = ?
        `).run(isPaid ? 'paid' : 'partial', invoice.id);

        remainingPayment -= allocate;
        applied.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, allocatedPaise: allocate });
      }

      // Update payment record allocation state
      db.prepare(`
        UPDATE customer_payment_records 
        SET unallocated_paise = ?, is_allocated = ?
        WHERE id = ?
      `).run(remainingPayment, remainingPayment <= 0 ? 1 : 0, paymentId);

      // 5. Create advance deposit if any payment amount remains unallocated
      let advanceCreated = 0;
      if (remainingPayment > 0) {
        advanceCreated = remainingPayment;
        db.prepare(`
          INSERT INTO customer_advance_payments (customer_id, payment_record_id, amount_paise, remaining_paise, method, reference_number, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(customerId, paymentId, remainingPayment, remainingPayment, parsed.method, parsed.reference_number ?? null, 'Overpayment deposit to customer advance', userId);

        db.prepare(`
          UPDATE customers
          SET advance_balance_paise = advance_balance_paise + ?
          WHERE id = ?
        `).run(remainingPayment, customerId);

        // Ledger row for advance deposit
        const lastLedger = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
        const currentBal = lastLedger ? lastLedger.running_balance_paise : 0;
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
          ) VALUES (?, 'advance_deposit', ?, NULL, 'Overpayment added to customer advance account', 0, 0, ?, ?)
        `).run(customerId, paymentId, currentBal, userId);
      }

      // Deduct total applied amount from outstanding balance
      const totalApplied = paymentAmount - remainingPayment;
      db.prepare(`
        UPDATE customers
        SET outstanding_balance_paise = MAX(0, outstanding_balance_paise - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(totalApplied, customerId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'payment_received', ?, ?)
      `).run(customerId, `Recorded payment of ₹${(paymentAmount/100).toFixed(2)}. Applied FIFO ₹${(totalApplied/100).toFixed(2)}, Advance added ₹${(remainingPayment/100).toFixed(2)}`, userId);

      return { paymentId, applied, advanceCreated };
    })();

    return { success: true, data: result };
  }

  public depositAdvance(rawInput: unknown) {
    const parsed = DepositAdvanceSchema.parse(rawInput);
    const userId = this.getCurrentUserId();
    const customerId = parsed.customer_id;
    const amount = parsed.amount_paise;

    const rowId = db.transaction(() => {
      // 1. Log payment receipt
      const resPay = db.prepare(`
        INSERT INTO customer_payment_records (
          customer_id, amount_paise, method, reference_number, is_advance, is_allocated, unallocated_paise, received_by
        ) VALUES (?, ?, ?, ?, 1, 0, ?, ?)
      `).run(customerId, amount, parsed.method, parsed.reference_number ?? null, amount, userId);
      const paymentId = resPay.lastInsertRowid as number;

      // 2. Insert advance payment record
      db.prepare(`
        INSERT INTO customer_advance_payments (customer_id, payment_record_id, amount_paise, remaining_paise, method, reference_number, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, paymentId, amount, amount, parsed.method, parsed.reference_number ?? null, parsed.notes ?? 'Manual advance deposit', userId);

      // 3. Update customer advance balance
      db.prepare(`
        UPDATE customers
        SET advance_balance_paise = advance_balance_paise + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amount, customerId);

      // 4. Post to ledger
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const startBalance = last ? last.running_balance_paise : 0;
      const nextBalance = startBalance - amount;

      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'advance_deposit', ?, NULL, ?, 0, ?, ?, ?)
      `).run(customerId, paymentId, 'Customer advance deposit recorded', amount, nextBalance, userId);

      db.prepare(`
        INSERT INTO customer_credit_transactions (customer_id, invoice_id, transaction_type, amount_paise, reference_number, created_by)
        VALUES (?, NULL, 'advance_deposit', ?, ?, ?)
      `).run(customerId, amount, parsed.reference_number ?? null, userId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'advance_deposit', ?, ?)
      `).run(customerId, `Deposited advance of ₹${(amount/100).toFixed(2)}`, userId);

      return paymentId;
    })();

    return db.prepare('SELECT * FROM customer_payment_records WHERE id = ?').get(rowId);
  }

  public applyAdvanceToInvoice(customerId: number, invoiceId: number, amountPaise: number) {
    const userId = this.getCurrentUserId();

    db.transaction(() => {
      // Find oldest active advances
      const advances = db.prepare(`
        SELECT id, remaining_paise FROM customer_advance_payments 
        WHERE customer_id = ? AND remaining_paise > 0 
        ORDER BY deposit_date ASC, id ASC
      `).all(customerId) as { id: number; remaining_paise: number }[];

      let toAllocate = amountPaise;
      for (const adv of advances) {
        if (toAllocate <= 0) break;
        const deduct = Math.min(adv.remaining_paise, toAllocate);
        
        db.prepare('UPDATE customer_advance_payments SET remaining_paise = remaining_paise - ? WHERE id = ?').run(deduct, adv.id);
        
        // Record payment record to link with invoice
        const resPay = db.prepare(`
          INSERT INTO customer_payment_records (
            customer_id, amount_paise, method, reference_number, is_advance, is_allocated, unallocated_paise, received_by
          ) VALUES (?, ?, 'advance_adjustment', ?, 0, 1, 0, ?)
        `).run(customerId, deduct, `ADV-${adv.id}`, userId);
        const paymentId = resPay.lastInsertRowid as number;

        db.prepare(`
          INSERT INTO customer_payment_allocations (payment_id, invoice_id, allocated_paise)
          VALUES (?, ?, ?)
        `).run(paymentId, invoiceId, deduct);

        toAllocate -= deduct;
      }

      // Update customer table totals
      db.prepare(`
        UPDATE customers
        SET advance_balance_paise = MAX(0, advance_balance_paise - ?),
            outstanding_balance_paise = MAX(0, outstanding_balance_paise - ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amountPaise, amountPaise, customerId);

      // Post to ledger
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const balance = last ? last.running_balance_paise : 0;
      
      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'advance_applied', ?, NULL, ?, 0, 0, ?, ?)
      `).run(customerId, invoiceId, `Advance applied to invoice ID ${invoiceId}`, balance, userId);

      db.prepare(`
        INSERT INTO customer_credit_transactions (customer_id, invoice_id, transaction_type, amount_paise, reference_number, created_by)
        VALUES (?, ?, 'advance_applied', ?, NULL, ?)
      `).run(customerId, invoiceId, amountPaise, userId);
    })();
  }

  public writeOff(customerId: number, amountPaise: number, reason: string) {
    const userId = this.getCurrentUserId();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
    
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      throw new PermissionError('Only managers and administrators are authorized to write off balances');
    }

    db.transaction(() => {
      // 1. Get ledger running balance
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const startBal = last ? last.running_balance_paise : 0;
      const nextBal = startBal - amountPaise;

      // 2. Insert ledger entry
      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'write_off', NULL, NULL, ?, 0, ?, ?, ?)
      `).run(customerId, `Write-off balance: ${reason}`, amountPaise, nextBal, userId);

      // 3. Update customer outstanding
      db.prepare(`
        UPDATE customers
        SET outstanding_balance_paise = MAX(0, outstanding_balance_paise - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amountPaise, customerId);

      // 4. Log credit transaction
      db.prepare(`
        INSERT INTO customer_credit_transactions (customer_id, invoice_id, transaction_type, amount_paise, reference_number, notes, created_by)
        VALUES (?, NULL, 'write_off', ?, NULL, ?, ?)
      `).run(customerId, amountPaise, reason, userId);

      // 5. Activity log
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'write_off', ?, ?)
      `).run(customerId, `Balance write-off of ₹${(amountPaise/100).toFixed(2)}. Reason: ${reason}`, userId);
    })();
  }

  public freezeCredit(customerId: number, reason: string) {
    const userId = this.getCurrentUserId();
    this.getCreditAccount(customerId); // ensure account exists
    db.transaction(() => {
      db.prepare(`
        UPDATE customer_credit_accounts
        SET is_frozen = 1, freeze_reason = ?, frozen_by = ?, frozen_at = CURRENT_TIMESTAMP
        WHERE customer_id = ?
      `).run(reason, userId, customerId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'freeze_credit', ?, ?)
      `).run(customerId, `Credit frozen: ${reason}`, userId);
    })();
  }

  public unfreezeCredit(customerId: number) {
    const userId = this.getCurrentUserId();
    this.getCreditAccount(customerId);
    db.transaction(() => {
      db.prepare(`
        UPDATE customer_credit_accounts
        SET is_frozen = 0, freeze_reason = NULL, frozen_by = NULL, frozen_at = NULL
        WHERE customer_id = ?
      `).run(customerId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'unfreeze_credit', 'Credit unfrozen', ?)
      `).run(customerId, userId);
    })();
  }

  public blacklist(customerId: number, reason: string) {
    const userId = this.getCurrentUserId();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
    if (!user || user.role !== 'ADMIN') {
      throw new PermissionError('Only administrators are authorized to blacklist customers');
    }

    this.getCreditAccount(customerId);
    db.transaction(() => {
      db.prepare(`
        UPDATE customer_credit_accounts
        SET is_blacklisted = 1, blacklist_reason = ?, blacklisted_by = ?, blacklisted_at = CURRENT_TIMESTAMP
        WHERE customer_id = ?
      `).run(reason, userId, customerId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'blacklist', ?, ?)
      `).run(customerId, `Customer blacklisted: ${reason}`, userId);
    })();
  }

  public unblacklist(customerId: number) {
    const userId = this.getCurrentUserId();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
    if (!user || user.role !== 'ADMIN') {
      throw new PermissionError('Only administrators are authorized to remove customers from the blacklist');
    }

    this.getCreditAccount(customerId);
    db.transaction(() => {
      db.prepare(`
        UPDATE customer_credit_accounts
        SET is_blacklisted = 0, blacklist_reason = NULL, blacklisted_by = NULL, blacklisted_at = NULL
        WHERE customer_id = ?
      `).run(customerId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'unblacklist', 'Customer removed from blacklist', ?)
      `).run(customerId, userId);
    })();
  }

  public createCreditNote(customerId: number, originalInvoiceId: number | null, amountPaise: number, reason: string) {
    const userId = this.getCurrentUserId();
    const parsed = CreditNoteSchema.parse({ customer_id: customerId, original_invoice_id: originalInvoiceId, amount_paise: amountPaise, reason });

    const creditNote = db.transaction(() => {
      // 1. Generate credit note number
      const currentYear = new Date().getFullYear().toString();
      db.prepare("INSERT OR IGNORE INTO credit_note_sequences (financial_year, last_number) VALUES (?, 0)").run(currentYear);
      db.prepare("UPDATE credit_note_sequences SET last_number = last_number + 1 WHERE financial_year = ?").run(currentYear);
      const seq = db.prepare("SELECT last_number FROM credit_note_sequences WHERE financial_year = ?").get(currentYear) as { last_number: number };
      const numberStr = `CN-${currentYear}-${String(seq.last_number).padStart(5, '0')}`;

      // 2. Insert credit note record
      const res = db.prepare(`
        INSERT INTO customer_credit_notes (credit_note_number, customer_id, original_invoice_id, amount_paise, reason, is_applied, applied_to_invoice_id, applied_at, created_by)
        VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, ?)
      `).run(numberStr, customerId, originalInvoiceId, amountPaise, reason, userId);

      const cnId = res.lastInsertRowid as number;

      // 3. Post to ledger running balance
      const last = db.prepare('SELECT running_balance_paise FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId) as { running_balance_paise: number } | undefined;
      const start = last ? last.running_balance_paise : 0;
      const next = start - amountPaise;

      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
        ) VALUES (?, 'credit_note', ?, NULL, ?, 0, ?, ?, ?)
      `).run(customerId, cnId, `Credit Note ${numberStr} generated: ${reason}`, amountPaise, next, userId);

      // 4. Update customer outstanding (reduces amount customer owes)
      db.prepare(`
        UPDATE customers
        SET outstanding_balance_paise = MAX(0, outstanding_balance_paise - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amountPaise, customerId);

      // 5. Log activity
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'credit_note', ?, ?)
      `).run(customerId, `Generated credit note ${numberStr} of amount ₹${(amountPaise/100).toFixed(2)}`, userId);

      return cnId;
    })();

    return db.prepare('SELECT * FROM customer_credit_notes WHERE id = ?').get(creditNote);
  }

  public getUnappliedCreditNotes(customerId: number) {
    return db.prepare('SELECT * FROM customer_credit_notes WHERE customer_id = ? AND is_applied = 0 ORDER BY created_at DESC').all();
  }

  public getUnpaidInvoicesForCustomer(customerId: number) {
    // Computes dynamic unpaid remaining amounts
    return db.prepare(`
      SELECT id, invoice_number, total_paise, completed_at, payment_status,
        (total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as remaining_paise
      FROM invoices
      WHERE customer_id = ? AND status = 'completed' AND payment_status IN ('unpaid', 'partial')
      ORDER BY completed_at ASC
    `).all(customerId);
  }

  public getCreditTransactions(customerId: number, limit = 50) {
    return db.prepare(`
      SELECT * FROM customer_credit_transactions 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(customerId, limit);
  }
}

export const creditService = new CreditService();
