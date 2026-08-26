import { db } from '../../../../core/backend/db';

export interface PaymentRow {
  id: number;
  invoice_id: number;
  method: 'cash' | 'upi' | 'card' | 'split';
  amount_paise: number;
  reference_number: string | null;
  received_at: string;
}

export interface CreatePaymentInput {
  invoice_id: number;
  method: 'cash' | 'upi' | 'card' | 'split';
  amount_paise: number;
  reference_number?: string | null;
}

const paymentsRepository = {
  findByInvoiceId(invoiceId: number): PaymentRow[] {
    return db.prepare(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY received_at'
    ).all(invoiceId) as PaymentRow[];
  },

  create(input: CreatePaymentInput): PaymentRow {
    const result = db.prepare(`
      INSERT INTO payments (invoice_id, method, amount_paise, reference_number)
      VALUES (@invoice_id, @method, @amount_paise, @reference_number)
    `).run({
      invoice_id: input.invoice_id,
      method: input.method,
      amount_paise: input.amount_paise,
      reference_number: input.reference_number ?? null,
    });
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid) as PaymentRow;
  },

  sumByInvoiceId(invoiceId: number): number {
    const row = db.prepare(
      'SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payments WHERE invoice_id = ?'
    ).get(invoiceId) as { total: number };
    return row.total;
  },

  deleteByInvoiceId(invoiceId: number): void {
    db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(invoiceId);
  },
};

export { paymentsRepository };
