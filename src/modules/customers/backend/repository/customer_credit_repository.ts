import { Database } from 'better-sqlite3';
import { IDatabaseProvider } from '../../../../core/database/database_provider';
import { NotFoundError } from '../../../../core/backend/errors';

export interface CreditAccountRow {
  id: number;
  customer_id: number;
  credit_limit_paise: number;
  soft_limit_paise: number;
  hard_limit_paise: number;
  grace_days: number;
  max_overdue_days: number;
  interest_rate_percent: number;
  is_frozen: number;
  freeze_reason: string | null;
  frozen_by: number | null;
  frozen_at: string | null;
  is_blacklisted: number;
  blacklist_reason: string | null;
  blacklisted_by: number | null;
  blacklisted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditTransactionRow {
  id: number;
  customer_id: number;
  invoice_id: number | null;
  transaction_type: string;
  amount_paise: number;
  reference_number: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

export interface CreditNoteRow {
  id: number;
  credit_note_number: string;
  customer_id: number;
  original_invoice_id: number | null;
  amount_paise: number;
  reason: string;
  is_applied: number;
  applied_to_invoice_id: number | null;
  applied_at: string | null;
  created_by: number | null;
  created_at: string;
}

export class CustomerCreditRepository {
  constructor(private dbProvider: IDatabaseProvider) {}

  private get db(): Database {
    return this.dbProvider.getRawConnection();
  }

  private getAccountById(id: number): CreditAccountRow {
    const row = this.db
      .prepare('SELECT * FROM customer_credit_accounts WHERE id = ?')
      .get(id) as CreditAccountRow | undefined;
    if (!row) throw new NotFoundError(`Credit account with id ${id} not found`);
    return row;
  }

  public getAccount(customerId: number): CreditAccountRow | undefined {
    return this.db
      .prepare('SELECT * FROM customer_credit_accounts WHERE customer_id = ?')
      .get(customerId) as CreditAccountRow | undefined;
  }

  public getOrCreateAccount(customerId: number): CreditAccountRow {
    const existing = this.getAccount(customerId);
    if (existing) return existing;

    // Fetch the customer's configured credit limit to seed defaults
    const customerRow = this.db
      .prepare('SELECT credit_limit_paise FROM customers WHERE id = ?')
      .get(customerId) as { credit_limit_paise: number } | undefined;

    const creditLimit = customerRow?.credit_limit_paise ?? 0;

    const stmt = this.db.prepare(`
      INSERT INTO customer_credit_accounts (
        customer_id,
        credit_limit_paise,
        soft_limit_paise,
        hard_limit_paise,
        grace_days,
        max_overdue_days,
        interest_rate_percent,
        is_frozen,
        is_blacklisted
      ) VALUES (
        @customer_id,
        @credit_limit_paise,
        @soft_limit_paise,
        @hard_limit_paise,
        @grace_days,
        @max_overdue_days,
        @interest_rate_percent,
        0,
        0
      )
    `);

    const result = stmt.run({
      customer_id: customerId,
      credit_limit_paise: creditLimit,
      soft_limit_paise: Math.floor(creditLimit * 0.9),
      hard_limit_paise: creditLimit,
      grace_days: 7,
      max_overdue_days: 30,
      interest_rate_percent: 0,
    });

    return this.getAccountById(result.lastInsertRowid as number);
  }

  public updateAccount(
    customerId: number,
    fields: Partial<
      Pick<
        CreditAccountRow,
        | 'credit_limit_paise'
        | 'soft_limit_paise'
        | 'hard_limit_paise'
        | 'grace_days'
        | 'max_overdue_days'
        | 'interest_rate_percent'
      >
    >
  ): CreditAccountRow {
    const existing = this.getOrCreateAccount(customerId);

    this.db
      .prepare(
        `UPDATE customer_credit_accounts SET
           credit_limit_paise    = @credit_limit_paise,
           soft_limit_paise      = @soft_limit_paise,
           hard_limit_paise      = @hard_limit_paise,
           grace_days            = @grace_days,
           max_overdue_days      = @max_overdue_days,
           interest_rate_percent = @interest_rate_percent,
           updated_at            = CURRENT_TIMESTAMP
         WHERE customer_id = @customer_id`
      )
      .run({
        customer_id: customerId,
        credit_limit_paise: fields.credit_limit_paise ?? existing.credit_limit_paise,
        soft_limit_paise: fields.soft_limit_paise ?? existing.soft_limit_paise,
        hard_limit_paise: fields.hard_limit_paise ?? existing.hard_limit_paise,
        grace_days: fields.grace_days ?? existing.grace_days,
        max_overdue_days: fields.max_overdue_days ?? existing.max_overdue_days,
        interest_rate_percent:
          fields.interest_rate_percent ?? existing.interest_rate_percent,
      });

    return this.getOrCreateAccount(customerId);
  }

  public freezeAccount(customerId: number, reason: string, frozenBy: number): void {
    this.db
      .prepare(
        `UPDATE customer_credit_accounts
         SET is_frozen    = 1,
             freeze_reason = ?,
             frozen_by    = ?,
             frozen_at    = CURRENT_TIMESTAMP,
             updated_at   = CURRENT_TIMESTAMP
         WHERE customer_id = ?`
      )
      .run(reason, frozenBy, customerId);
  }

  public unfreezeAccount(customerId: number): void {
    this.db
      .prepare(
        `UPDATE customer_credit_accounts
         SET is_frozen     = 0,
             freeze_reason = NULL,
             frozen_by     = NULL,
             frozen_at     = NULL,
             updated_at    = CURRENT_TIMESTAMP
         WHERE customer_id = ?`
      )
      .run(customerId);
  }

  public blacklistCustomer(
    customerId: number,
    reason: string,
    blacklistedBy: number
  ): void {
    this.db
      .prepare(
        `UPDATE customer_credit_accounts
         SET is_blacklisted    = 1,
             blacklist_reason  = ?,
             blacklisted_by    = ?,
             blacklisted_at    = CURRENT_TIMESTAMP,
             updated_at        = CURRENT_TIMESTAMP
         WHERE customer_id = ?`
      )
      .run(reason, blacklistedBy, customerId);
  }

  public unblacklistCustomer(customerId: number): void {
    this.db
      .prepare(
        `UPDATE customer_credit_accounts
         SET is_blacklisted   = 0,
             blacklist_reason = NULL,
             blacklisted_by   = NULL,
             blacklisted_at   = NULL,
             updated_at       = CURRENT_TIMESTAMP
         WHERE customer_id = ?`
      )
      .run(customerId);
  }

  public createTransaction(input: {
    customer_id: number;
    invoice_id?: number | null;
    transaction_type: string;
    amount_paise: number;
    reference_number?: string | null;
    notes?: string | null;
    created_by?: number | null;
  }): CreditTransactionRow {
    const stmt = this.db.prepare(`
      INSERT INTO customer_credit_transactions (
        customer_id, invoice_id, transaction_type,
        amount_paise, reference_number, notes, created_by
      ) VALUES (
        @customer_id, @invoice_id, @transaction_type,
        @amount_paise, @reference_number, @notes, @created_by
      )
    `);

    const result = stmt.run({
      customer_id: input.customer_id,
      invoice_id: input.invoice_id ?? null,
      transaction_type: input.transaction_type,
      amount_paise: input.amount_paise,
      reference_number: input.reference_number ?? null,
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
    });

    const created = this.db
      .prepare('SELECT * FROM customer_credit_transactions WHERE id = ?')
      .get(result.lastInsertRowid) as CreditTransactionRow | undefined;
    if (!created) throw new Error('Failed to create credit transaction');
    return created;
  }

  public getTransactions(customerId: number, limit = 50): CreditTransactionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM customer_credit_transactions
         WHERE customer_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(customerId, limit) as CreditTransactionRow[];
  }

  public createCreditNote(input: {
    customer_id: number;
    original_invoice_id?: number | null;
    amount_paise: number;
    reason: string;
    created_by?: number | null;
  }): CreditNoteRow {
    const createFn = this.db.transaction(() => {
      // Upsert the sequence row and get the next number
      this.db
        .prepare(
          `INSERT INTO credit_note_sequences (year, last_number)
           VALUES (strftime('%Y', 'now'), 1)
           ON CONFLICT(year) DO UPDATE SET last_number = last_number + 1`
        )
        .run();

      const seqRow = this.db
        .prepare(
          `SELECT year, last_number FROM credit_note_sequences
           WHERE year = strftime('%Y', 'now')`
        )
        .get() as { year: string; last_number: number } | undefined;

      if (!seqRow) throw new Error('Failed to generate credit note sequence');

      const creditNoteNumber = `CN-${seqRow.year}-${String(seqRow.last_number).padStart(5, '0')}`;

      const stmt = this.db.prepare(`
        INSERT INTO credit_notes (
          credit_note_number, customer_id, original_invoice_id,
          amount_paise, reason, is_applied, created_by
        ) VALUES (
          @credit_note_number, @customer_id, @original_invoice_id,
          @amount_paise, @reason, 0, @created_by
        )
      `);

      const result = stmt.run({
        credit_note_number: creditNoteNumber,
        customer_id: input.customer_id,
        original_invoice_id: input.original_invoice_id ?? null,
        amount_paise: input.amount_paise,
        reason: input.reason,
        created_by: input.created_by ?? null,
      });

      return result.lastInsertRowid as number;
    });

    const newId = createFn();
    const created = this.db
      .prepare('SELECT * FROM credit_notes WHERE id = ?')
      .get(newId) as CreditNoteRow | undefined;
    if (!created) throw new Error('Failed to create credit note');
    return created;
  }

  public applyCreditNote(creditNoteId: number, invoiceId: number): void {
    this.db
      .prepare(
        `UPDATE credit_notes
         SET is_applied             = 1,
             applied_to_invoice_id  = ?,
             applied_at             = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(invoiceId, creditNoteId);
  }

  public getUnappliedCreditNotes(customerId: number): CreditNoteRow[] {
    return this.db
      .prepare(
        `SELECT * FROM credit_notes
         WHERE customer_id = ? AND is_applied = 0
         ORDER BY created_at ASC`
      )
      .all(customerId) as CreditNoteRow[];
  }
}
