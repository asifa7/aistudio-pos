import { container } from '../../../../core/di/container';
import { db } from '../../../../core/backend/db';
import { ValidationError, NotFoundError } from '../../../../core/backend/errors';
import { SupplierPaymentSchema } from '../validation/supplier_procurement.schema';
import {
  SupplierPaymentRow,
  SupplierLedgerEntryRow,
  PurchaseInvoiceRow
} from '../../../../core/database/repositories/repository_interfaces';

export class SupplierLedgerService {
  private get supplierPaymentRepo() {
    return container.supplierPaymentRepository;
  }

  private get supplierLedgerRepo() {
    return container.supplierLedgerRepository;
  }

  private get purchaseInvoiceRepo() {
    return container.purchaseInvoiceRepository;
  }

  private get supplierProfileRepo() {
    return container.supplierProfileRepository;
  }

  public recordPayment(raw: unknown, userId: number): SupplierPaymentRow {
    const parsed = SupplierPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid supplier payment input', parsed.error.flatten());
    }

    return container.databaseProvider.transaction(() => {
      // 1. Create the payment record (handles subtracting payment amount from supplier's outstanding balance)
      const payment = this.supplierPaymentRepo.create({
        supplier_id: parsed.data.supplier_id,
        amount_paise: parsed.data.amount_paise,
        payment_method: parsed.data.payment_method,
        reference_number: parsed.data.reference_number,
        cheque_number: parsed.data.cheque_number,
        cheque_date: parsed.data.cheque_date,
        bank_name: parsed.data.bank_name,
        payment_date: parsed.data.payment_date,
        notes: parsed.data.notes,
        is_advance: parsed.data.is_advance ?? 0,
        unallocated_amount_paise: parsed.data.amount_paise, // initially unallocated
        created_by: userId,
      });

      // 2. Insert into supplier_ledger (Debits reduce outstanding balance)
      this.supplierLedgerRepo.create({
        supplier_id: parsed.data.supplier_id,
        entry_date: parsed.data.payment_date,
        ref_type: 'payment',
        ref_id: payment.id,
        description: `Payment via ${parsed.data.payment_method.toUpperCase()}${parsed.data.reference_number ? ' (Ref: ' + parsed.data.reference_number + ')' : ''}`,
        debit_paise: parsed.data.amount_paise,
        credit_paise: 0,
        status: 'approved',
      });

      // 3. FIFO allocate the payment across unpaid or partially paid invoices for the supplier
      let remainingAmount = payment.amount_paise;
      const invoices = db.prepare(`
        SELECT * FROM purchase_invoices 
        WHERE supplier_id = ? AND payment_status != 'paid' 
        ORDER BY invoice_date ASC, id ASC
      `).all(parsed.data.supplier_id) as PurchaseInvoiceRow[];

      for (const invoice of invoices) {
        if (remainingAmount <= 0) break;
        const allocAmount = Math.min(remainingAmount, invoice.outstanding_amount_paise);
        if (allocAmount > 0) {
          // allocatePayment handles adding allocation row, updating invoice outstanding & status,
          // and updating payment's unallocated amount.
          this.supplierPaymentRepo.allocatePayment(payment.id, invoice.id, allocAmount);
          remainingAmount -= allocAmount;
        }
      }

      // Re-fetch the updated payment record
      return this.supplierPaymentRepo.findById(payment.id)!;
    });
  }

  public recordLedgerAdjustment(
    supplierId: number,
    amountPaise: number,
    type: 'debit' | 'credit',
    description: string,
    userId: number
  ): SupplierLedgerEntryRow {
    if (amountPaise <= 0) {
      throw new ValidationError('Adjustment amount must be positive');
    }

    const supplier = this.supplierProfileRepo.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with id ${supplierId} not found`);
    }

    return container.databaseProvider.transaction(() => {
      const debit = type === 'debit' ? amountPaise : 0;
      const credit = type === 'credit' ? amountPaise : 0;

      // 1. Create the ledger entry
      const entry = this.supplierLedgerRepo.create({
        supplier_id: supplierId,
        entry_date: new Date().toISOString().slice(0, 10),
        ref_type: 'adjustment',
        description,
        debit_paise: debit,
        credit_paise: credit,
        status: 'approved',
      });

      // 2. Update suppliers.outstanding_balance_paise (Credit increases outstanding, Debit reduces it)
      const delta = type === 'credit' ? amountPaise : -amountPaise;
      this.supplierProfileRepo.updateOutstandingBalance(supplierId, delta);

      // 3. Log activity
      db.prepare(`
        INSERT INTO supplier_activity_logs (supplier_id, action_type, performed_by, details)
        VALUES (?, 'ADJUSTMENT', ?, ?)
      `).run(supplierId, userId, JSON.stringify({ type, amountPaise, description }));

      return entry;
    });
  }

  public getLedger(supplierId: number): SupplierLedgerEntryRow[] {
    const supplier = this.supplierProfileRepo.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with id ${supplierId} not found`);
    }
    return this.supplierLedgerRepo.findBySupplierId(supplierId);
  }

  public getStatement(supplierId: number, startDate: string, endDate: string): any {
    const supplier = this.supplierProfileRepo.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with id ${supplierId} not found`);
    }

    const summary = container.supplierReportRepository.getSupplierLedgerSummary(supplierId, startDate, endDate);
    
    const entries = db.prepare(`
      SELECT * FROM supplier_ledger 
      WHERE supplier_id = ? AND DATE(entry_date) BETWEEN DATE(?) AND DATE(?)
      ORDER BY entry_date ASC, id ASC
    `).all(supplierId, startDate, endDate) as SupplierLedgerEntryRow[];

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        company_name: supplier.company_name,
        gstin: supplier.gstin,
        phone: supplier.phone,
        email: supplier.email,
        outstanding_balance_paise: supplier.outstanding_balance_paise,
      },
      startDate,
      endDate,
      openingBalancePaise: summary.opening_balance_paise,
      totalDebitPaise: summary.total_debit_paise,
      totalCreditPaise: summary.total_credit_paise,
      closingBalancePaise: summary.closing_balance_paise,
      entries,
    };
  }
}

export const supplierLedgerService = new SupplierLedgerService();
export default supplierLedgerService;
