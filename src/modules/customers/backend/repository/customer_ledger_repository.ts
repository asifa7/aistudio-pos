import { Database } from 'better-sqlite3';
import { IDatabaseProvider } from '../../../../core/database/database_provider';

export interface LedgerEntryRow {
  id: number;
  customer_id: number;
  entry_date: string;
  ref_type: string;
  ref_id: number | null;
  invoice_number: string | null;
  description: string;
  debit_paise: number;
  credit_paise: number;
  running_balance_paise: number;
  created_by: number | null;
  created_at: string;
}

export interface CreateLedgerEntryInput {
  customer_id: number;
  entry_date?: string;
  ref_type:
    | 'opening_balance'
    | 'invoice'
    | 'payment'
    | 'advance_deposit'
    | 'advance_applied'
    | 'credit_note'
    | 'debit_note'
    | 'adjustment'
    | 'write_off'
    | 'interest'
    | 'refund';
  ref_id?: number | null;
  invoice_number?: string | null;
  description: string;
  debit_paise: number;
  credit_paise: number;
  running_balance_paise: number;
  created_by?: number | null;
}

export class CustomerLedgerRepository {
  constructor(private dbProvider: IDatabaseProvider) {}

  private get db(): Database {
    return this.dbProvider.getRawConnection();
  }

  public getLastBalance(customer_id: number): number {
    const row = this.db
      .prepare(
        `SELECT running_balance_paise
         FROM customer_ledger
         WHERE customer_id = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(customer_id) as { running_balance_paise: number } | undefined;
    return row?.running_balance_paise ?? 0;
  }

  public postEntry(input: CreateLedgerEntryInput): LedgerEntryRow {
    const stmt = this.db.prepare(`
      INSERT INTO customer_ledger (
        customer_id, entry_date, ref_type, ref_id,
        invoice_number, description,
        debit_paise, credit_paise, running_balance_paise,
        created_by
      ) VALUES (
        @customer_id,
        COALESCE(@entry_date, DATE('now')),
        @ref_type, @ref_id,
        @invoice_number, @description,
        @debit_paise, @credit_paise, @running_balance_paise,
        @created_by
      )
    `);

    const result = stmt.run({
      customer_id: input.customer_id,
      entry_date: input.entry_date ?? null,
      ref_type: input.ref_type,
      ref_id: input.ref_id ?? null,
      invoice_number: input.invoice_number ?? null,
      description: input.description,
      debit_paise: input.debit_paise,
      credit_paise: input.credit_paise,
      running_balance_paise: input.running_balance_paise,
      created_by: input.created_by ?? null,
    });

    const created = this.db
      .prepare('SELECT * FROM customer_ledger WHERE id = ?')
      .get(result.lastInsertRowid) as LedgerEntryRow | undefined;
    if (!created) throw new Error('Failed to post ledger entry');
    return created;
  }

  public getLedger(
    customer_id: number,
    opts?: { startDate?: string; endDate?: string; limit?: number; offset?: number }
  ): LedgerEntryRow[] {
    const conditions: string[] = ['customer_id = @customer_id'];
    const params: Record<string, unknown> = { customer_id };

    if (opts?.startDate) {
      conditions.push('entry_date >= @startDate');
      params['startDate'] = opts.startDate;
    }
    if (opts?.endDate) {
      conditions.push('entry_date <= @endDate');
      params['endDate'] = opts.endDate;
    }

    const where = conditions.join(' AND ');
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    params['limit'] = limit;
    params['offset'] = offset;

    return this.db
      .prepare(
        `SELECT * FROM customer_ledger
         WHERE ${where}
         ORDER BY id ASC
         LIMIT @limit OFFSET @offset`
      )
      .all(params) as LedgerEntryRow[];
  }

  public getLedgerCount(
    customer_id: number,
    opts?: { startDate?: string; endDate?: string }
  ): number {
    const conditions: string[] = ['customer_id = @customer_id'];
    const params: Record<string, unknown> = { customer_id };

    if (opts?.startDate) {
      conditions.push('entry_date >= @startDate');
      params['startDate'] = opts.startDate;
    }
    if (opts?.endDate) {
      conditions.push('entry_date <= @endDate');
      params['endDate'] = opts.endDate;
    }

    const where = conditions.join(' AND ');
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM customer_ledger WHERE ${where}`)
      .get(params) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  public getOpeningBalanceForPeriod(customer_id: number, startDate: string): number {
    const row = this.db
      .prepare(
        `SELECT running_balance_paise
         FROM customer_ledger
         WHERE customer_id = ? AND entry_date < ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(customer_id, startDate) as { running_balance_paise: number } | undefined;
    return row?.running_balance_paise ?? 0;
  }
}
