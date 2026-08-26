import { db } from '../../../../core/backend/db';
import { NotFoundError } from '../../../../core/backend/errors';
import { customerService } from './customer_service';

export class ARReportsService {
  public getCustomerLedger(customerId: number, opts: { startDate?: string; endDate?: string; limit?: number; offset?: number } = {}) {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    let baseQuery = 'SELECT * FROM customer_ledger WHERE customer_id = ?';
    const params: any[] = [customerId];

    if (opts.startDate) {
      baseQuery += ' AND entry_date >= ?';
      params.push(opts.startDate);
    }
    if (opts.endDate) {
      baseQuery += ' AND entry_date <= ?';
      params.push(opts.endDate);
    }

    baseQuery += ' ORDER BY id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(baseQuery).all(...params);
  }

  public getCustomerStatement(customerId: number, startDate: string, endDate: string) {
    const customer = customerService.getCustomerById(customerId) as any;

    // 1. Get opening balance (running balance of the last entry before startDate)
    const lastPriorEntry = db.prepare(`
      SELECT running_balance_paise FROM customer_ledger 
      WHERE customer_id = ? AND entry_date < ? 
      ORDER BY id DESC LIMIT 1
    `).get(customerId, startDate) as { running_balance_paise: number } | undefined;

    const opening_balance_paise = lastPriorEntry ? lastPriorEntry.running_balance_paise : customer.opening_balance_paise;

    // 2. Get entries in period
    const entries = db.prepare(`
      SELECT * FROM customer_ledger 
      WHERE customer_id = ? AND entry_date BETWEEN ? AND ? 
      ORDER BY id ASC
    `).all(customerId, startDate, endDate) as any[];

    // 3. Calculate summary metrics
    let total_debits_paise = 0;
    let total_credits_paise = 0;
    for (const entry of entries) {
      total_debits_paise += entry.debit_paise;
      total_credits_paise += entry.credit_paise;
    }

    const closing_balance_paise = entries.length > 0 
      ? entries[entries.length - 1].running_balance_paise 
      : opening_balance_paise;

    return {
      customer,
      opening_balance_paise,
      entries,
      closing_balance_paise,
      total_debits_paise,
      total_credits_paise,
      startDate,
      endDate
    };
  }

  public getAgingReport(asOfDate?: string) {
    const targetDate = asOfDate || new Date().toISOString().split('T')[0];

    // Read all customers with active credit accounts or non-zero outstanding balances
    const customers = db.prepare(`
      SELECT c.id, c.customer_code, c.name, c.phone, c.outstanding_balance_paise, c.credit_limit_paise, 
             cca.is_frozen, cca.is_blacklisted
      FROM customers c
      LEFT JOIN customer_credit_accounts cca ON c.id = cca.customer_id
      WHERE c.outstanding_balance_paise > 0 OR c.credit_allowed = 1
    `).all() as any[];

    const result: any[] = [];

    for (const cust of customers) {
      // Find all unpaid invoices
      const unpaid = db.prepare(`
        SELECT id, completed_at, total_paise,
          (total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as remaining_paise
        FROM invoices
        WHERE customer_id = ? AND status = 'completed' AND completed_at <= ? AND payment_status IN ('unpaid', 'partial')
      `).all(cust.id, targetDate + ' 23:59:59') as { completed_at: string; remaining_paise: number }[];

      let current_paise = 0;
      let days_1_30_paise = 0;
      let days_31_60_paise = 0;
      let days_61_90_paise = 0;
      let days_91_180_paise = 0;
      let days_180_plus_paise = 0;

      for (const inv of unpaid) {
        if (inv.remaining_paise <= 0) continue;
        const diffMs = new Date(targetDate).getTime() - new Date(inv.completed_at).getTime();
        const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (days === 0) {
          current_paise += inv.remaining_paise;
        } else if (days <= 30) {
          days_1_30_paise += inv.remaining_paise;
        } else if (days <= 60) {
          days_31_60_paise += inv.remaining_paise;
        } else if (days <= 90) {
          days_61_90_paise += inv.remaining_paise;
        } else if (days <= 180) {
          days_91_180_paise += inv.remaining_paise;
        } else {
          days_180_plus_paise += inv.remaining_paise;
        }
      }

      const totalUnpaid = current_paise + days_1_30_paise + days_31_60_paise + days_61_90_paise + days_91_180_paise + days_180_plus_paise;

      // Find last payment date
      const lastPay = db.prepare(`
        SELECT payment_date FROM customer_payment_records 
        WHERE customer_id = ? AND payment_date <= ?
        ORDER BY payment_date DESC LIMIT 1
      `).get(cust.id, targetDate) as { payment_date: string } | undefined;

      // Risk estimation
      let risk_level: 'low' | 'medium' | 'high' = 'low';
      if (cust.is_blacklisted === 1 || cust.is_frozen === 1 || days_91_180_paise > 0 || days_180_plus_paise > 0) {
        risk_level = 'high';
      } else if (days_31_60_paise > 0 || days_61_90_paise > 0) {
        risk_level = 'medium';
      }

      result.push({
        customer_id: cust.id,
        customer_code: cust.customer_code,
        name: cust.name,
        phone: cust.phone,
        outstanding_paise: totalUnpaid,
        current_paise,
        days_1_30_paise,
        days_31_60_paise,
        days_61_90_paise,
        days_91_180_paise,
        days_180_plus_paise,
        last_payment_date: lastPay ? lastPay.payment_date : null,
        credit_limit_paise: cust.credit_limit_paise,
        available_credit_paise: Math.max(0, cust.credit_limit_paise - totalUnpaid),
        risk_level
      });
    }

    return result;
  }

  public getOutstandingReport(filters: { category?: string; minOutstanding?: number } = {}) {
    let query = `
      SELECT c.*, cg.name as group_name 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      WHERE c.outstanding_balance_paise > 0
    `;
    const params: any[] = [];

    if (filters.category) {
      query += ' AND c.category = ?';
      params.push(filters.category);
    }
    if (filters.minOutstanding) {
      query += ' AND c.outstanding_balance_paise >= ?';
      params.push(filters.minOutstanding);
    }

    query += ' ORDER BY c.outstanding_balance_paise DESC';
    return db.prepare(query).all(...params);
  }

  public getCollectionReport(startDate: string, endDate: string) {
    const payments = db.prepare(`
      SELECT p.*, c.name as customer_name, c.customer_code 
      FROM customer_payment_records p
      JOIN customers c ON p.customer_id = c.id
      WHERE p.payment_date BETWEEN ? AND ?
      ORDER BY p.payment_date DESC, p.id DESC
    `).all(startDate, endDate) as any[];

    // Aggregate by payment method
    const by_method: Record<string, number> = { cash: 0, upi: 0, card: 0, bank_transfer: 0, cheque: 0, advance_adjustment: 0 };
    let total_collected_paise = 0;

    for (const p of payments) {
      total_collected_paise += p.amount_paise;
      if (by_method[p.method] !== undefined) {
        by_method[p.method] += p.amount_paise;
      }
    }

    return {
      total_collected_paise,
      by_method,
      payments
    };
  }

  public getAdvanceBalanceReport() {
    return db.prepare(`
      SELECT c.*, cg.name as group_name 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      WHERE c.advance_balance_paise > 0
      ORDER BY c.advance_balance_paise DESC
    `).all();
  }

  public getOverdueReport(asOfDate?: string) {
    const target = asOfDate || new Date().toISOString().split('T')[0];

    const customers = db.prepare(`
      SELECT c.id, c.customer_code, c.name, c.phone, c.outstanding_balance_paise
      FROM customers c
      WHERE c.outstanding_balance_paise > 0
    `).all() as any[];

    const result: any[] = [];
    for (const cust of customers) {
      // Find the oldest invoice overdue by more than 30 days
      const oldest = db.prepare(`
        SELECT completed_at, invoice_number FROM invoices 
        WHERE customer_id = ? AND status = 'completed' AND payment_status IN ('unpaid', 'partial')
        ORDER BY completed_at ASC LIMIT 1
      `).get(cust.id) as { completed_at: string; invoice_number: string } | undefined;

      if (oldest?.completed_at) {
        const days = Math.floor((new Date(target).getTime() - new Date(oldest.completed_at).getTime()) / (1000 * 60 * 60 * 24));
        if (days > 30) {
          // Get last reminder date
          const lastReminder = db.prepare(`
            SELECT created_at FROM customer_reminders 
            WHERE customer_id = ? AND status = 'sent' 
            ORDER BY created_at DESC LIMIT 1
          `).get(cust.id) as { created_at: string } | undefined;

          result.push({
            id: cust.id,
            customer_code: cust.customer_code,
            name: cust.name,
            phone: cust.phone,
            outstanding_balance_paise: cust.outstanding_balance_paise,
            days_overdue: days,
            oldest_invoice_number: oldest.invoice_number,
            oldest_invoice_date: oldest.completed_at,
            last_reminder_sent_at: lastReminder ? lastReminder.created_at : null
          });
        }
      }
    }
    // Sort by days overdue descending
    return result.sort((a, b) => b.days_overdue - a.days_overdue);
  }

  public getTopDebtors(limit = 10) {
    return db.prepare(`
      SELECT c.*, cg.name as group_name 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      WHERE c.outstanding_balance_paise > 0
      ORDER BY c.outstanding_balance_paise DESC
      LIMIT ?
    `).all(limit);
  }

  public getCreditLimitUtilization() {
    return db.prepare(`
      SELECT c.id, c.customer_code, c.name, c.outstanding_balance_paise, c.credit_limit_paise,
        (CAST(c.outstanding_balance_paise AS REAL) / c.credit_limit_paise * 100) as utilization_percent
      FROM customers c
      WHERE c.credit_allowed = 1 AND c.credit_limit_paise > 0
      ORDER BY utilization_percent DESC
    `).all();
  }
}

export const arReportsService = new ARReportsService();
