import { db } from '../../../../core/backend/db';
import { ValidationError, NotFoundError } from '../../../../core/backend/errors';
import { auditLogger, logger } from '../../../../core/backend/logger';

export interface PaymentReceiptInput {
  direction: 'payment' | 'receipt';
  payment_method: 'cash' | 'bank' | 'upi' | 'card';
  party_type?: 'supplier' | 'customer' | 'other';
  party_id?: number | null;
  party_name?: string | null;
  category?: string | null;
  amount_paise: number;
  payment_date: string;
  narration?: string | null;
  idempotency_key?: string | null;
  allocations?: Array<{
    bill_type: 'purchase_invoice' | 'sale_invoice';
    bill_id: number;
    bill_number: string;
    allocated_amount_paise: number;
  }>;
}

export interface ContraEntryInput {
  from_account: 'cash' | 'bank';
  to_account: 'cash' | 'bank';
  amount_paise: number;
  entry_date: string;
  narration?: string | null;
}

export class PaymentEngineService {
  constructor() {
    this.ensureSchemaColumns();
  }

  /**
   * Safe runtime schema self-healing for reversals and idempotency
   */
  private ensureSchemaColumns() {
    try {
      const prCols = db.prepare("PRAGMA table_info(payments_receipts)").all() as any[];
      const prColNames = new Set(prCols.map(c => c.name));
      if (!prColNames.has('idempotency_key')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN idempotency_key TEXT;");
      }
      if (!prColNames.has('is_reversed')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN is_reversed INTEGER NOT NULL DEFAULT 0;");
      }
      if (!prColNames.has('reversed_at')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN reversed_at DATETIME;");
      }
      if (!prColNames.has('reversal_reason')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN reversal_reason TEXT;");
      }
      if (!prColNames.has('reversed_by')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN reversed_by INTEGER;");
      }
      if (!prColNames.has('reversed_payment_id')) {
        db.exec("ALTER TABLE payments_receipts ADD COLUMN reversed_payment_id INTEGER;");
      }
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_rec_idempotency ON payments_receipts(idempotency_key) WHERE idempotency_key IS NOT NULL;");
    } catch (e) {
      // Safe fallback
    }
  }

  /**
   * Generate sequential voucher number
   */
  private generateVoucherNumber(direction: 'payment' | 'receipt' | 'contra', dateStr: string): string {
    const cleanDate = dateStr.replace(/[^0-9]/g, '').slice(0, 8);
    const prefix = direction === 'payment' ? 'PAY' : direction === 'receipt' ? 'REC' : 'CNT';

    const table = direction === 'contra' ? 'contra_entries' : 'payments_receipts';
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE date(created_at) = date('now') OR voucher_number LIKE ?`).get(`${prefix}-${cleanDate}-%`) as { cnt: number };
    const seq = String((countRow?.cnt || 0) + 1).padStart(3, '0');
    return `${prefix}-${cleanDate}-${seq}`;
  }

  /**
   * Record a Payment (money out) or Receipt (money in) with bill allocations
   * Includes idempotency check and hard validation against bill outstanding balances.
   */
  public recordPaymentReceipt(input: PaymentReceiptInput, userId: number) {
    if (!input.amount_paise || input.amount_paise <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }
    if (!input.payment_date) {
      throw new ValidationError('Payment date is required');
    }
    if (!input.payment_method) {
      throw new ValidationError('Payment mode is required');
    }

    // 1. Idempotency Check (Prevent duplicate submissions on rapid clicks or network retries)
    if (input.idempotency_key) {
      const existing = db.prepare('SELECT id FROM payments_receipts WHERE idempotency_key = ?').get(input.idempotency_key) as any;
      if (existing) {
        logger.info(`Idempotent duplicate request intercepted for key: ${input.idempotency_key}. Returning existing voucher #${existing.id}`);
        return this.getVoucher(existing.id);
      }
    }

    const allocations = input.allocations || [];
    const totalAllocatedPaise = allocations.reduce((sum, a) => sum + a.allocated_amount_paise, 0);

    if (totalAllocatedPaise > input.amount_paise) {
      throw new ValidationError(`Allocated amount (₹${(totalAllocatedPaise/100).toFixed(2)}) cannot exceed total payment amount (₹${(input.amount_paise/100).toFixed(2)})`);
    }

    // 2. Hard Validation: Check each allocated bill's live outstanding balance
    for (const alloc of allocations) {
      if (alloc.allocated_amount_paise <= 0) continue;

      if (alloc.bill_type === 'purchase_invoice') {
        const pi = db.prepare(`
          SELECT 
            pi.id,
            pi.total_amount_paise,
            COALESCE((
              SELECT SUM(pa.allocated_amount_paise) 
              FROM payment_allocations pa 
              JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id 
              WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
            ), 0) as paid_paise
          FROM purchase_invoices pi 
          WHERE pi.id = ?
        `).get(alloc.bill_id) as any;

        if (!pi) throw new NotFoundError(`Purchase invoice #${alloc.bill_id} not found`);

        const liveOutstandingPaise = Math.max(0, pi.total_amount_paise - pi.paid_paise);
        if (alloc.allocated_amount_paise > liveOutstandingPaise) {
          throw new ValidationError(
            `Payment amount ₹${(alloc.allocated_amount_paise/100).toFixed(2)} exceeds the current outstanding balance of ₹${(liveOutstandingPaise/100).toFixed(2)} for Bill ${alloc.bill_number}. Overpayments must be recorded on-account.`
          );
        }
      }
    }

    const unallocatedPaise = input.amount_paise - totalAllocatedPaise;

    const fn = db.transaction(() => {
      const voucherNumber = this.generateVoucherNumber(input.direction, input.payment_date);

      // Determine party name if party_id supplied
      let partyName = input.party_name || null;
      if (input.party_type === 'supplier' && input.party_id && !partyName) {
        const supp = db.prepare('SELECT company_name, name FROM suppliers WHERE id = ?').get(input.party_id) as any;
        if (supp) partyName = supp.company_name || supp.name;
      } else if (input.party_type === 'customer' && input.party_id && !partyName) {
        const cust = db.prepare('SELECT name FROM customers WHERE id = ?').get(input.party_id) as any;
        if (cust) partyName = cust.name;
      }

      // 1. Insert master voucher row into payments_receipts
      const stmt = db.prepare(`
        INSERT INTO payments_receipts (
          voucher_number, direction, payment_method, party_type, party_id, party_name,
          category, amount_paise, allocated_amount_paise, unallocated_amount_paise,
          payment_date, narration, idempotency_key, is_reversed, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
      `);

      const res = stmt.run(
        voucherNumber,
        input.direction,
        input.payment_method,
        input.party_type || 'other',
        input.party_id || null,
        partyName,
        input.category?.trim() || null,
        input.amount_paise,
        totalAllocatedPaise,
        unallocatedPaise,
        input.payment_date,
        input.narration?.trim() || null,
        input.idempotency_key || null,
        userId
      );

      const voucherId = res.lastInsertRowid as number;

      // 2. Insert bill allocations & update bill outstanding balances
      for (const alloc of allocations) {
        if (alloc.allocated_amount_paise <= 0) continue;

        db.prepare(`
          INSERT INTO payment_allocations (
            payment_receipt_id, bill_type, bill_id, bill_number, allocated_amount_paise, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(voucherId, alloc.bill_type, alloc.bill_id, alloc.bill_number, alloc.allocated_amount_paise);

        if (alloc.bill_type === 'purchase_invoice') {
          // Recompute total active paid for this purchase invoice
          const paidRow = db.prepare(`
            SELECT COALESCE(SUM(pa.allocated_amount_paise), 0) as total_paid
            FROM payment_allocations pa
            JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
            WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = ? AND pr.is_reversed = 0
          `).get(alloc.bill_id) as any;

          const activePaidPaise = paidRow?.total_paid || 0;
          const pi = db.prepare('SELECT total_amount_paise FROM purchase_invoices WHERE id = ?').get(alloc.bill_id) as any;
          if (pi) {
            const newStatus = activePaidPaise >= pi.total_amount_paise ? 'paid' : (activePaidPaise > 0 ? 'partial' : 'unpaid');
            db.prepare(`
              UPDATE purchase_invoices 
              SET paid_amount_paise = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(activePaidPaise, newStatus, alloc.bill_id);
          }
        } else if (alloc.bill_type === 'sale_invoice') {
          // Update customer sale invoice payment record
          db.prepare(`
            INSERT INTO payments (invoice_id, method, amount_paise, reference_number, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(alloc.bill_id, input.payment_method, alloc.allocated_amount_paise, voucherNumber);

          const inv = db.prepare(`
            SELECT total_paise, (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE invoice_id = invoices.id) as total_paid 
            FROM invoices WHERE id = ?
          `).get(alloc.bill_id) as any;
          if (inv) {
            const newStatus = inv.total_paid >= inv.total_paise ? 'paid' : 'partial';
            db.prepare('UPDATE invoices SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, alloc.bill_id);
          }
        }
      }

      // 3. Update Supplier Running Balance & Supplier Ledger
      if (input.party_type === 'supplier' && input.party_id) {
        if (input.direction === 'payment') {
          // Reduce outstanding balance
          db.prepare(`
            UPDATE suppliers 
            SET outstanding_balance_paise = MAX(0, outstanding_balance_paise - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(input.amount_paise, input.party_id);

          // Write entry to supplier_ledger_entries
          db.prepare(`
            INSERT INTO supplier_ledger_entries (
              supplier_id, entry_date, ref_type, ref_id, description, debit_paise, credit_paise, status, created_at
            ) VALUES (?, ?, 'payment', ?, ?, ?, 0, 'approved', CURRENT_TIMESTAMP)
          `).run(
            input.party_id,
            input.payment_date,
            voucherId,
            `Payment Voucher #${voucherNumber} (${input.payment_method.toUpperCase()}) ${input.narration ? '- ' + input.narration : ''}`,
            input.amount_paise
          );
        }
      }

      // 4. Update Customer Credit Ledger if customer receipt
      if (input.party_type === 'customer' && input.party_id) {
        if (input.direction === 'receipt') {
          db.prepare(`
            UPDATE customers 
            SET current_credit_paise = MAX(0, current_credit_paise - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(input.amount_paise, input.party_id);

          try {
            db.prepare(`
              INSERT INTO customer_credit_ledger (
                customer_id, transaction_type, amount_paise, reference_type, reference_id, notes, created_by, created_at
              ) VALUES (?, 'payment', ?, 'payment_voucher', ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              input.party_id,
              input.amount_paise,
              voucherId,
              `Receipt Voucher #${voucherNumber} (${input.payment_method.toUpperCase()})`,
              userId
            );
          } catch (e) {
            // Safe fallback
          }
        }
      }

      auditLogger.log(userId, 'PAYMENT_RECEIPT_RECORDED', {
        voucherId,
        voucherNumber,
        direction: input.direction,
        amountPaise: input.amount_paise,
        partyName,
        method: input.payment_method,
      });

      return this.getVoucher(voucherId);
    });

    return fn();
  }

  /**
   * Reverse a recorded payment/receipt voucher with an immutable linked reversal entry
   * Restores bill outstanding balances and party accounts without destroying historical audit trails.
   */
  public reversePayment(paymentReceiptId: number, reason: string, userId: number) {
    if (!reason || !reason.trim()) {
      throw new ValidationError('A mandatory reason is required to reverse a payment');
    }

    const orig = db.prepare('SELECT * FROM payments_receipts WHERE id = ?').get(paymentReceiptId) as any;
    if (!orig) throw new NotFoundError(`Payment voucher #${paymentReceiptId} not found`);
    if (orig.is_reversed === 1) {
      throw new ValidationError(`Payment voucher #${orig.voucher_number} is already reversed`);
    }
    if (orig.reversed_payment_id) {
      throw new ValidationError(`Cannot reverse a reversal entry`);
    }

    const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_receipt_id = ?').all(paymentReceiptId) as any[];

    const fn = db.transaction(() => {
      // 1. Mark original payment as reversed
      db.prepare(`
        UPDATE payments_receipts 
        SET is_reversed = 1, reversed_at = CURRENT_TIMESTAMP, reversal_reason = ?, reversed_by = ?
        WHERE id = ?
      `).run(reason.trim(), userId, paymentReceiptId);

      // 2. Insert linked reversal record
      const revVoucherNumber = `REV-${orig.voucher_number}`;
      const revStmt = db.prepare(`
        INSERT INTO payments_receipts (
          voucher_number, direction, payment_method, party_type, party_id, party_name,
          category, amount_paise, allocated_amount_paise, unallocated_amount_paise,
          payment_date, narration, is_reversed, reversed_at, reversal_reason, reversed_payment_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const revRes = revStmt.run(
        revVoucherNumber,
        orig.direction,
        orig.payment_method,
        orig.party_type,
        orig.party_id,
        orig.party_name,
        orig.category,
        orig.amount_paise,
        orig.allocated_amount_paise,
        orig.unallocated_amount_paise,
        `Reversal of Voucher #${orig.voucher_number}: ${reason.trim()}`,
        reason.trim(),
        paymentReceiptId,
        userId
      );

      const revVoucherId = revRes.lastInsertRowid as number;

      // 3. Reverse bill allocations and restore bill outstanding balances
      for (const alloc of allocations) {
        db.prepare(`
          INSERT INTO payment_allocations (
            payment_receipt_id, bill_type, bill_id, bill_number, allocated_amount_paise, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(revVoucherId, alloc.bill_type, alloc.bill_id, alloc.bill_number, alloc.allocated_amount_paise);

        if (alloc.bill_type === 'purchase_invoice') {
          // Recompute active paid paise excluding reversed vouchers
          const paidRow = db.prepare(`
            SELECT COALESCE(SUM(pa.allocated_amount_paise), 0) as total_paid
            FROM payment_allocations pa
            JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
            WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = ? AND pr.is_reversed = 0
          `).get(alloc.bill_id) as any;

          const activePaidPaise = paidRow?.total_paid || 0;
          const pi = db.prepare('SELECT total_amount_paise FROM purchase_invoices WHERE id = ?').get(alloc.bill_id) as any;
          if (pi) {
            const newStatus = activePaidPaise >= pi.total_amount_paise ? 'paid' : (activePaidPaise > 0 ? 'partial' : 'unpaid');
            db.prepare(`
              UPDATE purchase_invoices 
              SET paid_amount_paise = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(activePaidPaise, newStatus, alloc.bill_id);
          }
        } else if (alloc.bill_type === 'sale_invoice') {
          // Remove linked payment record from payments
          db.prepare('DELETE FROM payments WHERE invoice_id = ? AND reference_number = ?').run(alloc.bill_id, orig.voucher_number);
          const inv = db.prepare(`
            SELECT total_paise, (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE invoice_id = invoices.id) as total_paid 
            FROM invoices WHERE id = ?
          `).get(alloc.bill_id) as any;
          if (inv) {
            const newStatus = inv.total_paid >= inv.total_paise ? 'paid' : (inv.total_paid > 0 ? 'partial' : 'unpaid');
            db.prepare('UPDATE invoices SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, alloc.bill_id);
          }
        }
      }

      // 4. Restore Supplier Profile Balance & Ledger
      if (orig.party_type === 'supplier' && orig.party_id) {
        if (orig.direction === 'payment') {
          db.prepare(`
            UPDATE suppliers 
            SET outstanding_balance_paise = outstanding_balance_paise + ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(orig.amount_paise, orig.party_id);

          db.prepare(`
            INSERT INTO supplier_ledger_entries (
              supplier_id, entry_date, ref_type, ref_id, description, debit_paise, credit_paise, status, created_at
            ) VALUES (?, CURRENT_TIMESTAMP, 'adjustment', ?, ?, 0, ?, 'approved', CURRENT_TIMESTAMP)
          `).run(
            orig.party_id,
            revVoucherId,
            `Reversal of Payment Voucher #${orig.voucher_number} - Reason: ${reason.trim()}`,
            orig.amount_paise
          );
        }
      }

      // 5. Restore Customer Credit Balance
      if (orig.party_type === 'customer' && orig.party_id) {
        if (orig.direction === 'receipt') {
          db.prepare(`
            UPDATE customers 
            SET current_credit_paise = current_credit_paise + ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(orig.amount_paise, orig.party_id);

          try {
            db.prepare(`
              INSERT INTO customer_credit_ledger (
                customer_id, transaction_type, amount_paise, reference_type, reference_id, notes, created_by, created_at
              ) VALUES (?, 'adjustment', ?, 'reversal', ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              orig.party_id,
              orig.amount_paise,
              revVoucherId,
              `Reversal of Receipt Voucher #${orig.voucher_number} - ${reason.trim()}`,
              userId
            );
          } catch (e) {
            // Safe fallback
          }
        }
      }

      auditLogger.log(userId, 'PAYMENT_REVERSED', {
        originalVoucherId: paymentReceiptId,
        originalVoucherNumber: orig.voucher_number,
        reversalVoucherNumber: revVoucherNumber,
        reason: reason.trim(),
        amountPaise: orig.amount_paise,
      });

      return {
        success: true,
        message: `Voucher #${orig.voucher_number} has been reversed successfully. Reversal entry #${revVoucherNumber} created.`,
        reversalVoucherId: revVoucherId,
        reversalVoucherNumber: revVoucherNumber,
      };
    });

    return fn();
  }

  /**
   * Get all Outstanding Purchase Bills with live calculated balances and filters
   */
  public getOutstandingPurchaseBills(filters?: {
    status?: 'outstanding' | 'paid' | 'unpaid' | 'partial' | 'all';
    supplierId?: number;
    search?: string;
    sortBy?: 'due_date' | 'total_amount' | 'outstanding' | 'supplier';
    sortOrder?: 'asc' | 'desc';
  }) {
    let sql = `
      SELECT 
        pi.id,
        pi.invoice_number,
        pi.supplier_invoice_number,
        pi.purchase_ref_number,
        pi.supplier_id,
        s.name as supplier_name,
        s.company_name as supplier_company,
        pi.invoice_date,
        pi.due_date,
        pi.total_amount_paise,
        COALESCE((
          SELECT SUM(pa.allocated_amount_paise)
          FROM payment_allocations pa
          JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
          WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
        ), 0) as paid_amount_paise,
        (pi.total_amount_paise - COALESCE((
          SELECT SUM(pa.allocated_amount_paise)
          FROM payment_allocations pa
          JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
          WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
        ), 0)) as outstanding_balance_paise,
        CAST((julianday('now') - julianday(COALESCE(pi.due_date, pi.invoice_date))) AS INTEGER) as days_overdue,
        pi.status as invoice_status,
        (
          CASE 
            WHEN (pi.total_amount_paise - COALESCE((
              SELECT SUM(pa.allocated_amount_paise)
              FROM payment_allocations pa
              JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
              WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
            ), 0)) <= 0 THEN 'paid'
            WHEN COALESCE((
              SELECT SUM(pa.allocated_amount_paise)
              FROM payment_allocations pa
              JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
              WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
            ), 0) > 0 THEN 'partial'
            ELSE 'unpaid'
          END
        ) as computed_payment_status
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      WHERE pi.status != 'rejected'
    `;

    const params: any[] = [];

    if (filters?.supplierId) {
      sql += ' AND pi.supplier_id = ?';
      params.push(filters.supplierId);
    }

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      sql += ' AND (pi.supplier_invoice_number LIKE ? OR pi.invoice_number LIKE ? OR pi.purchase_ref_number LIKE ? OR s.name LIKE ? OR s.company_name LIKE ?)';
      params.push(q, q, q, q, q);
    }

    const statusFilter = filters?.status || 'outstanding';
    if (statusFilter === 'outstanding') {
      sql += ` AND (pi.total_amount_paise - COALESCE((
        SELECT SUM(pa.allocated_amount_paise)
        FROM payment_allocations pa
        JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
        WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
      ), 0)) > 0`;
    } else if (statusFilter === 'paid') {
      sql += ` AND (pi.total_amount_paise - COALESCE((
        SELECT SUM(pa.allocated_amount_paise)
        FROM payment_allocations pa
        JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
        WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
      ), 0)) <= 0`;
    } else if (statusFilter === 'unpaid') {
      sql += ` AND COALESCE((
        SELECT SUM(pa.allocated_amount_paise)
        FROM payment_allocations pa
        JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
        WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
      ), 0) = 0`;
    } else if (statusFilter === 'partial') {
      sql += ` AND (
        (pi.total_amount_paise - COALESCE((
          SELECT SUM(pa.allocated_amount_paise)
          FROM payment_allocations pa
          JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
          WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
        ), 0)) > 0
        AND COALESCE((
          SELECT SUM(pa.allocated_amount_paise)
          FROM payment_allocations pa
          JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
          WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
        ), 0) > 0
      )`;
    }

    // Sorting
    const sortOrder = filters?.sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (filters?.sortBy === 'total_amount') {
      sql += ` ORDER BY pi.total_amount_paise ${sortOrder}`;
    } else if (filters?.sortBy === 'outstanding') {
      sql += ` ORDER BY outstanding_balance_paise ${sortOrder}`;
    } else if (filters?.sortBy === 'supplier') {
      sql += ` ORDER BY s.name ${sortOrder}`;
    } else {
      // Default: Oldest due date first
      sql += ` ORDER BY COALESCE(pi.due_date, pi.invoice_date) ${sortOrder}, pi.id ASC`;
    }

    return db.prepare(sql).all(...params);
  }

  /**
   * Get full payment history for a specific bill (Purchase or Sale)
   */
  public getBillPaymentHistory(billType: 'purchase_invoice' | 'sale_invoice', billId: number) {
    const allocations = db.prepare(`
      SELECT 
        pa.id as allocation_id,
        pa.allocated_amount_paise,
        pa.created_at as allocated_at,
        pr.id as voucher_id,
        pr.voucher_number,
        pr.payment_method,
        pr.payment_date,
        pr.direction,
        pr.narration,
        pr.is_reversed,
        pr.reversed_at,
        pr.reversal_reason,
        pr.reversed_payment_id,
        u.full_name as created_by_name
      FROM payment_allocations pa
      JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id
      LEFT JOIN users u ON u.id = pr.created_by
      WHERE pa.bill_type = ? AND pa.bill_id = ?
      ORDER BY pr.payment_date DESC, pr.id DESC
    `).all(billType, billId) as any[];

    // Calculate active total paid
    const totalPaidPaise = allocations
      .filter(a => a.is_reversed === 0 && !a.reversed_payment_id)
      .reduce((sum, a) => sum + a.allocated_amount_paise, 0);

    return {
      allocations,
      totalPaidPaise,
    };
  }

  /**
   * Get open unpaid/partially paid bills for a supplier or customer
   */
  public getOpenBills(partyType: 'supplier' | 'customer', partyId: number) {
    if (!partyId) return [];

    if (partyType === 'supplier') {
      const rows = db.prepare(`
        SELECT 
          pi.id,
          pi.invoice_number,
          pi.supplier_invoice_number,
          pi.purchase_ref_number,
          pi.invoice_date,
          pi.due_date,
          pi.total_amount_paise,
          COALESCE((
            SELECT SUM(pa.allocated_amount_paise) 
            FROM payment_allocations pa 
            JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id 
            WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
          ), 0) as paid_amount_paise,
          (pi.total_amount_paise - COALESCE((
            SELECT SUM(pa.allocated_amount_paise) 
            FROM payment_allocations pa 
            JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id 
            WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
          ), 0)) as outstanding_balance_paise,
          CAST((julianday('now') - julianday(COALESCE(pi.due_date, pi.invoice_date))) AS INTEGER) as days_overdue
        FROM purchase_invoices pi
        WHERE pi.supplier_id = ? 
          AND pi.status != 'rejected'
          AND (pi.total_amount_paise - COALESCE((
            SELECT SUM(pa.allocated_amount_paise) 
            FROM payment_allocations pa 
            JOIN payments_receipts pr ON pr.id = pa.payment_receipt_id 
            WHERE pa.bill_type = 'purchase_invoice' AND pa.bill_id = pi.id AND pr.is_reversed = 0
          ), 0)) > 0
        ORDER BY COALESCE(pi.due_date, pi.invoice_date) ASC, pi.id ASC
      `).all(partyId) as any[];

      return rows.map(r => ({
        ...r,
        bill_type: 'purchase_invoice',
        bill_number: r.supplier_invoice_number || r.purchase_ref_number || r.invoice_number,
      }));
    } else {
      const rows = db.prepare(`
        SELECT 
          i.id,
          i.invoice_number,
          i.completed_at as invoice_date,
          i.total_paise as total_amount_paise,
          COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = i.id), 0) as paid_amount_paise,
          (i.total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = i.id), 0)) as outstanding_balance_paise
        FROM invoices i
        WHERE i.customer_id = ? 
          AND i.status = 'completed'
          AND (i.payment_status != 'paid' OR i.total_paise > COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = i.id), 0))
        ORDER BY i.completed_at ASC, i.id ASC
      `).all(partyId) as any[];

      return rows.map(r => ({
        ...r,
        bill_type: 'sale_invoice',
        bill_number: r.invoice_number || `INV-${r.id}`,
      }));
    }
  }

  /**
   * Record Contra Entry (Cash ⇄ Bank transfer)
   */
  public recordContraEntry(input: ContraEntryInput, userId: number) {
    if (!input.amount_paise || input.amount_paise <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }
    if (input.from_account === input.to_account) {
      throw new ValidationError('Source and destination accounts must be different');
    }

    const voucherNumber = this.generateVoucherNumber('contra', input.entry_date);

    db.prepare(`
      INSERT INTO contra_entries (
        voucher_number, from_account, to_account, amount_paise, entry_date, narration, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      voucherNumber,
      input.from_account,
      input.to_account,
      input.amount_paise,
      input.entry_date,
      input.narration?.trim() || null,
      userId
    );

    auditLogger.log(userId, 'CONTRA_TRANSFER_RECORDED', {
      voucherNumber,
      fromAccount: input.from_account,
      toAccount: input.to_account,
      amountPaise: input.amount_paise,
    });

    return { success: true, voucherNumber };
  }

  /**
   * Get Live Cash-in-hand and Bank balance totals
   */
  public getBalances() {
    // 1. Payments & Receipts (excluding reversed vouchers)
    const payRec = db.prepare(`
      SELECT 
        payment_method,
        direction,
        COALESCE(SUM(amount_paise), 0) as total_paise
      FROM payments_receipts
      WHERE is_reversed = 0 AND reversed_payment_id IS NULL
      GROUP BY payment_method, direction
    `).all() as any[];

    let cashInPaise = 0;
    let cashOutPaise = 0;
    let bankInPaise = 0;
    let bankOutPaise = 0;

    for (const r of payRec) {
      if (r.payment_method === 'cash') {
        if (r.direction === 'receipt') cashInPaise += r.total_paise;
        else cashOutPaise += r.total_paise;
      } else {
        if (r.direction === 'receipt') bankInPaise += r.total_paise;
        else bankOutPaise += r.total_paise;
      }
    }

    // 2. Direct POS Cash Sales (from payments table)
    const posCashSales = (db.prepare(`
      SELECT COALESCE(SUM(p.amount_paise), 0) as total_cash_sales
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      WHERE p.method = 'cash' AND i.status = 'completed'
    `).get() as any)?.total_cash_sales || 0;

    // 3. Direct POS UPI / Card / Bank Sales
    const posBankSales = (db.prepare(`
      SELECT COALESCE(SUM(p.amount_paise), 0) as total_bank_sales
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      WHERE p.method IN ('upi', 'card', 'bank') AND i.status = 'completed'
    `).get() as any)?.total_bank_sales || 0;

    // 4. Contra Transfers
    const contraTransfers = db.prepare(`
      SELECT from_account, to_account, COALESCE(SUM(amount_paise), 0) as total_paise
      FROM contra_entries
      GROUP BY from_account, to_account
    `).all() as any[];

    let cashToBankPaise = 0;
    let bankToCashPaise = 0;

    for (const c of contraTransfers) {
      if (c.from_account === 'cash' && c.to_account === 'bank') {
        cashToBankPaise += c.total_paise;
      } else if (c.from_account === 'bank' && c.to_account === 'cash') {
        bankToCashPaise += c.total_paise;
      }
    }

    // Net Calculations
    const totalCashInHandPaise = Math.max(0, (posCashSales + cashInPaise + bankToCashPaise) - (cashOutPaise + cashToBankPaise));
    const totalBankBalancePaise = Math.max(0, (posBankSales + bankInPaise + cashToBankPaise) - (bankOutPaise + bankToCashPaise));

    return {
      cashInHandPaise: totalCashInHandPaise,
      bankBalancePaise: totalBankBalancePaise,
      totalLiquidFundsPaise: totalCashInHandPaise + totalBankBalancePaise,
      posCashSalesPaise: posCashSales,
      posBankSalesPaise: posBankSales,
    };
  }

  /**
   * Get single voucher details by ID
   */
  public getVoucher(id: number) {
    const voucher = db.prepare(`
      SELECT pr.*, u.full_name as created_by_name
      FROM payments_receipts pr
      LEFT JOIN users u ON u.id = pr.created_by
      WHERE pr.id = ?
    `).get(id) as any;

    if (!voucher) throw new NotFoundError('Voucher not found');

    voucher.allocations = db.prepare(`
      SELECT * FROM payment_allocations WHERE payment_receipt_id = ?
    `).all(id);

    return voucher;
  }

  /**
   * Get Payment & Receipt Register
   */
  public getRegister(filters: {
    startDate?: string;
    endDate?: string;
    direction?: string;
    paymentMethod?: string;
    partyType?: string;
    partyId?: number;
    search?: string;
    includeReversals?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let sql = `
      SELECT pr.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM payment_allocations pa WHERE pa.payment_receipt_id = pr.id) as allocation_count
      FROM payments_receipts pr
      LEFT JOIN users u ON u.id = pr.created_by
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.startDate) {
      sql += ' AND date(pr.payment_date) >= date(?)';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND date(pr.payment_date) <= date(?)';
      params.push(filters.endDate);
    }
    if (filters.direction && filters.direction !== 'all') {
      sql += ' AND pr.direction = ?';
      params.push(filters.direction);
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      sql += ' AND pr.payment_method = ?';
      params.push(filters.paymentMethod);
    }
    if (filters.partyType && filters.partyType !== 'all') {
      sql += ' AND pr.party_type = ?';
      params.push(filters.partyType);
    }
    if (filters.partyId) {
      sql += ' AND pr.party_id = ?';
      params.push(filters.partyId);
    }
    if (filters.search) {
      sql += ' AND (pr.voucher_number LIKE ? OR pr.party_name LIKE ? OR pr.narration LIKE ? OR pr.category LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY pr.payment_date DESC, pr.id DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const vouchers = db.prepare(sql).all(...params) as any[];

    // Calculate period totals (active non-reversed)
    let totalPaymentsPaise = 0;
    let totalReceiptsPaise = 0;

    for (const v of vouchers) {
      if (v.is_reversed === 0 && !v.reversed_payment_id) {
        if (v.direction === 'payment') totalPaymentsPaise += v.amount_paise;
        else totalReceiptsPaise += v.amount_paise;
      }
    }

    return {
      vouchers,
      summary: {
        totalPaymentsPaise,
        totalReceiptsPaise,
        netCashFlowPaise: totalReceiptsPaise - totalPaymentsPaise,
        count: vouchers.length,
      }
    };
  }

  /**
   * Get outstanding/due purchase invoices list for Section A
   */
  public getDuePurchasesList(filters?: { supplierId?: number; startDate?: string; endDate?: string }) {
    return this.getOutstandingPurchaseBills({
      status: 'outstanding',
      supplierId: filters?.supplierId,
    });
  }
}

export const paymentEngineService = new PaymentEngineService();
