import { Database } from 'better-sqlite3';
import { IDatabaseProvider } from '../../../../core/database/database_provider';
import { NotFoundError } from '../../../../core/backend/errors';

export interface CustomerPaymentRow {
  id: number;
  customer_id: number;
  amount_paise: number;
  method: string;
  reference_number: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  bank_name: string | null;
  payment_date: string;
  notes: string | null;
  is_advance: number;
  is_allocated: number;
  unallocated_paise: number;
  received_by: number | null;
  created_at: string;
}

export interface CreatePaymentInput {
  customer_id: number;
  amount_paise: number;
  method: string;
  reference_number?: string | null;
  cheque_number?: string | null;
  cheque_date?: string | null;
  bank_name?: string | null;
  payment_date?: string;
  notes?: string | null;
  is_advance?: boolean;
  received_by?: number | null;
}

export interface AllocationRow {
  id: number;
  payment_id: number;
  invoice_id: number;
  allocated_paise: number;
  allocated_at: string;
}

export interface AdvancePaymentRow {
  id: number;
  customer_id: number;
  payment_record_id: number | null;
  amount_paise: number;
  remaining_paise: number;
  method: string;
  reference_number: string | null;
  deposit_date: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

export class CustomerPaymentRepository {
  constructor(private dbProvider: IDatabaseProvider) {}

  private get db(): Database {
    return this.dbProvider.getRawConnection();
  }

  public createPayment(input: CreatePaymentInput): CustomerPaymentRow {
    const isAdvance = input.is_advance ? 1 : 0;
    const stmt = this.db.prepare(`
      INSERT INTO customer_payments (
        customer_id, amount_paise, method,
        reference_number, cheque_number, cheque_date, bank_name,
        payment_date, notes,
        is_advance, is_allocated, unallocated_paise,
        received_by
      ) VALUES (
        @customer_id, @amount_paise, @method,
        @reference_number, @cheque_number, @cheque_date, @bank_name,
        COALESCE(@payment_date, DATE('now')), @notes,
        @is_advance, 0, @amount_paise,
        @received_by
      )
    `);

    const result = stmt.run({
      customer_id: input.customer_id,
      amount_paise: input.amount_paise,
      method: input.method,
      reference_number: input.reference_number ?? null,
      cheque_number: input.cheque_number ?? null,
      cheque_date: input.cheque_date ?? null,
      bank_name: input.bank_name ?? null,
      payment_date: input.payment_date ?? null,
      notes: input.notes ?? null,
      is_advance: isAdvance,
      received_by: input.received_by ?? null,
    });

    return this.findPaymentById(result.lastInsertRowid as number);
  }

  public findPaymentById(id: number): CustomerPaymentRow {
    const row = this.db
      .prepare('SELECT * FROM customer_payments WHERE id = ?')
      .get(id) as CustomerPaymentRow | undefined;
    if (!row) throw new NotFoundError(`Customer payment with id ${id} not found`);
    return row;
  }

  public getPaymentsByCustomer(customerId: number, limit = 50): CustomerPaymentRow[] {
    return this.db
      .prepare(
        `SELECT * FROM customer_payments
         WHERE customer_id = ?
         ORDER BY payment_date DESC, id DESC
         LIMIT ?`
      )
      .all(customerId, limit) as CustomerPaymentRow[];
  }

  public updateUnallocated(paymentId: number, newUnallocated: number): void {
    const isAllocated = newUnallocated <= 0 ? 1 : 0;
    this.db
      .prepare(
        `UPDATE customer_payments
         SET unallocated_paise = ?,
             is_allocated      = ?
         WHERE id = ?`
      )
      .run(newUnallocated, isAllocated, paymentId);
  }

  public createAllocation(
    paymentId: number,
    invoiceId: number,
    allocatedPaise: number
  ): AllocationRow {
    const stmt = this.db.prepare(`
      INSERT INTO customer_payment_allocations (payment_id, invoice_id, allocated_paise)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(paymentId, invoiceId, allocatedPaise);

    const created = this.db
      .prepare('SELECT * FROM customer_payment_allocations WHERE id = ?')
      .get(result.lastInsertRowid) as AllocationRow | undefined;
    if (!created) throw new Error('Failed to create payment allocation');
    return created;
  }

  public getAllocationsByPayment(paymentId: number): AllocationRow[] {
    return this.db
      .prepare(
        'SELECT * FROM customer_payment_allocations WHERE payment_id = ? ORDER BY id'
      )
      .all(paymentId) as AllocationRow[];
  }

  public getAllocationsByInvoice(invoiceId: number): AllocationRow[] {
    return this.db
      .prepare(
        'SELECT * FROM customer_payment_allocations WHERE invoice_id = ? ORDER BY id'
      )
      .all(invoiceId) as AllocationRow[];
  }

  public createAdvancePayment(input: {
    customer_id: number;
    payment_record_id?: number | null;
    amount_paise: number;
    method: string;
    reference_number?: string | null;
    notes?: string | null;
    created_by?: number | null;
  }): AdvancePaymentRow {
    const stmt = this.db.prepare(`
      INSERT INTO customer_advance_payments (
        customer_id, payment_record_id, amount_paise, remaining_paise,
        method, reference_number, deposit_date, notes, created_by
      ) VALUES (
        @customer_id, @payment_record_id, @amount_paise, @amount_paise,
        @method, @reference_number, DATE('now'), @notes, @created_by
      )
    `);

    const result = stmt.run({
      customer_id: input.customer_id,
      payment_record_id: input.payment_record_id ?? null,
      amount_paise: input.amount_paise,
      method: input.method,
      reference_number: input.reference_number ?? null,
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
    });

    const created = this.db
      .prepare('SELECT * FROM customer_advance_payments WHERE id = ?')
      .get(result.lastInsertRowid) as AdvancePaymentRow | undefined;
    if (!created) throw new Error('Failed to create advance payment');
    return created;
  }

  public getAdvancesByCustomer(customerId: number): AdvancePaymentRow[] {
    return this.db
      .prepare(
        `SELECT * FROM customer_advance_payments
         WHERE customer_id = ? AND remaining_paise > 0
         ORDER BY deposit_date ASC, id ASC`
      )
      .all(customerId) as AdvancePaymentRow[];
  }

  public deductAdvance(advanceId: number, amountPaise: number): void {
    this.db
      .prepare(
        `UPDATE customer_advance_payments
         SET remaining_paise = MAX(0, remaining_paise - ?)
         WHERE id = ?`
      )
      .run(amountPaise, advanceId);
  }
}
