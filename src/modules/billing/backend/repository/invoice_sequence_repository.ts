import { db } from '../../../../core/backend/db';

export interface InvoiceSequenceRow {
  id: number;
  financial_year: string;
  last_number: number;
}

const invoiceSequenceRepository = {
  getAndIncrement(financialYear: string): number {
    db.prepare(`
      INSERT INTO invoice_sequences (financial_year, last_number)
      VALUES (@fy, 1)
      ON CONFLICT(financial_year) DO UPDATE SET last_number = last_number + 1
    `).run({ fy: financialYear });

    const row = db.prepare(
      'SELECT last_number FROM invoice_sequences WHERE financial_year = ?'
    ).get(financialYear) as { last_number: number };

    return row.last_number;
  },

  getCurrent(financialYear: string): number {
    const row = db.prepare(
      'SELECT last_number FROM invoice_sequences WHERE financial_year = ?'
    ).get(financialYear) as { last_number: number } | undefined;
    return row?.last_number ?? 0;
  },
};

export { invoiceSequenceRepository };
