import { db } from '../../../../core/backend/db';
import { NotFoundError } from '../../../../core/backend/errors';

export interface InvoiceRow {
  id: number;
  invoice_number: string | null;
  financial_year: string | null;
  customer_id: number | null;
  customer_face_id: number | null;
  status: 'draft' | 'held' | 'completed' | 'void' | 'returned';
  is_gst_invoice: number;
  gst_number_snapshot: string | null;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  tax_paise: number;
  total_paise: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  created_by: number;
  created_at: string;
  completed_at: string | null;
  voided_by: number | null;
  void_reason: string | null;
  voided_at: string | null;
  discount_paise: number;
  discount_reason: string | null;
  discount_applied_by: number | null;
  discount_percent?: number;
  flat_deduction_paise?: number;
  dressing_charge_paise?: number;
  round_off_paise?: number;
  narration?: string | null;
  print_delivery_token?: number;
  shop_name_snapshot: string | null;
  shop_address_snapshot: string | null;
}

export interface CreateInvoiceInput {
  created_by: number;
  is_gst_invoice?: boolean;
  gst_number_snapshot?: string | null;
  customer_id?: number | null;
}

export interface CompleteInvoiceUpdate {
  invoice_number: string;
  financial_year: string;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  tax_paise: number;
  total_paise: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  discount_paise: number;
  discount_reason: string | null;
  discount_applied_by: number | null;
  discount_percent?: number;
  flat_deduction_paise?: number;
  dressing_charge_paise?: number;
  round_off_paise?: number;
  narration?: string | null;
  print_delivery_token?: number;
  shop_name_snapshot: string;
  shop_address_snapshot: string;
}

const invoiceRepository = {
  findById(id: number): InvoiceRow {
    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
    if (!row) {
      throw new NotFoundError(`Invoice with id ${id} not found`);
    }
    return row;
  },

  findByInvoiceNumber(invoiceNumber: string): InvoiceRow | undefined {
    return db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(invoiceNumber) as InvoiceRow | undefined;
  },

  getTodayBills(): InvoiceRow[] {
    const today = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT * FROM invoices 
      WHERE status IN ('completed', 'void') AND date(created_at) = date(?)
      ORDER BY id DESC
    `).all(today) as InvoiceRow[];
  },

  createDraft(input: CreateInvoiceInput): InvoiceRow {
    const result = db.prepare(`
      INSERT INTO invoices (
        status, is_gst_invoice, gst_number_snapshot, customer_id,
        subtotal_paise, cgst_paise, sgst_paise, tax_paise, total_paise,
        payment_status, created_by
      ) VALUES (
        'draft', @is_gst_invoice, @gst_number_snapshot, @customer_id,
        0, 0, 0, 0, 0, 'unpaid', @created_by
      )
    `).run({
      is_gst_invoice: input.is_gst_invoice ? 1 : 0,
      gst_number_snapshot: input.gst_number_snapshot ?? null,
      customer_id: input.customer_id ?? null,
      created_by: input.created_by,
    });
    return invoiceRepository.findById(result.lastInsertRowid as number);
  },

  setStatus(id: number, status: InvoiceRow['status']): void {
    db.prepare('UPDATE invoices SET status = @status WHERE id = @id').run({ id, status });
  },

  completeInvoice(id: number, update: CompleteInvoiceUpdate): void {
    db.prepare(`
      UPDATE invoices SET
        invoice_number = @invoice_number,
        financial_year = @financial_year,
        status = 'completed',
        subtotal_paise = @subtotal_paise,
        cgst_paise = @cgst_paise,
        sgst_paise = @sgst_paise,
        tax_paise = @tax_paise,
        total_paise = @total_paise,
        payment_status = @payment_status,
        discount_paise = @discount_paise,
        discount_reason = @discount_reason,
        discount_applied_by = @discount_applied_by,
        discount_percent = COALESCE(@discount_percent, 0),
        flat_deduction_paise = COALESCE(@flat_deduction_paise, 0),
        dressing_charge_paise = COALESCE(@dressing_charge_paise, 0),
        round_off_paise = COALESCE(@round_off_paise, 0),
        narration = @narration,
        print_delivery_token = COALESCE(@print_delivery_token, 0),
        shop_name_snapshot = @shop_name_snapshot,
        shop_address_snapshot = @shop_address_snapshot,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id,
      ...update,
      discount_percent: update.discount_percent ?? 0,
      flat_deduction_paise: update.flat_deduction_paise ?? 0,
      dressing_charge_paise: update.dressing_charge_paise ?? 0,
      round_off_paise: update.round_off_paise ?? 0,
      narration: update.narration ?? null,
      print_delivery_token: update.print_delivery_token ? 1 : 0,
    });
  },

  voidInvoice(id: number, voidedBy: number, voidReason: string): void {
    db.prepare(`
      UPDATE invoices SET
        status = 'void',
        voided_by = @voided_by,
        void_reason = @void_reason,
        voided_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id, voided_by: voidedBy, void_reason: voidReason });
  },

  setReturned(id: number): void {
    db.prepare("UPDATE invoices SET status = 'returned' WHERE id = ?").run(id);
  },

  updateGstToggle(id: number, isGst: boolean, gstNumberSnapshot: string | null): void {
    db.prepare(`
      UPDATE invoices SET is_gst_invoice = @is_gst, gst_number_snapshot = @gst_snapshot WHERE id = @id
    `).run({ id, is_gst: isGst ? 1 : 0, gst_snapshot: gstNumberSnapshot });
  },

  updatePaymentStatus(id: number, status: InvoiceRow['payment_status']): void {
    db.prepare('UPDATE invoices SET payment_status = @status WHERE id = @id').run({ id, status });
  },

  listByStatus(status: InvoiceRow['status']): InvoiceRow[] {
    return db.prepare(
      'SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC'
    ).all(status) as InvoiceRow[];
  },

  listHeld(): InvoiceRow[] {
    return db.prepare(
      "SELECT * FROM invoices WHERE status IN ('draft', 'held') ORDER BY created_at DESC"
    ).all() as InvoiceRow[];
  },

  searchInvoices(filter: {
    billNumber?: string;
    itemName?: string;
    quantity?: number;
    minAmount?: number;
    maxAmount?: number;
    startDate?: string;
    endDate?: string;
    paymentStatus?: string;
  }): any[] {
    let sql = `
      SELECT DISTINCT i.*, 
             c.name as customer_name,
             (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.status IN ('completed', 'void', 'returned')
    `;
    const params: any = {};

    const hasBillNum = filter.billNumber && filter.billNumber.trim().length > 0;

    if (filter.startDate) {
      sql += ` AND date(i.created_at) >= date(@startDate)`;
      params.startDate = filter.startDate;
    }
    if (filter.endDate) {
      sql += ` AND date(i.created_at) <= date(@endDate)`;
      params.endDate = filter.endDate;
    }
    if (hasBillNum) {
      const cleanNum = filter.billNumber!.trim().replace(/^#/, '');
      sql += ` AND (i.invoice_number = @billExact OR CAST(i.id AS TEXT) = @billExact)`;
      params.billExact = cleanNum;
    }
    if (filter.itemName && filter.itemName.trim()) {
      sql += ` AND (ii.product_name LIKE @itemName OR ii.variant_name LIKE @itemName)`;
      params.itemName = `%${filter.itemName.trim()}%`;
    }
    if (filter.quantity !== undefined && filter.quantity !== null && !isNaN(filter.quantity) && filter.quantity > 0) {
      sql += ` AND (ii.quantity_units = @qty OR (ii.quantity_grams IS NOT NULL AND ROUND(ii.quantity_grams / 1000.0, 3) = @qty))`;
      params.qty = filter.quantity;
    }
    if (filter.minAmount !== undefined && filter.minAmount !== null && !isNaN(filter.minAmount) && filter.minAmount >= 0) {
      sql += ` AND i.total_paise >= @minAmtPaise`;
      params.minAmtPaise = Math.round(filter.minAmount * 100);
    }
    if (filter.maxAmount !== undefined && filter.maxAmount !== null && !isNaN(filter.maxAmount) && filter.maxAmount > 0) {
      sql += ` AND i.total_paise <= @maxAmtPaise`;
      params.maxAmtPaise = Math.round(filter.maxAmount * 100);
    }
    if (filter.paymentStatus && filter.paymentStatus !== 'all') {
      sql += ` AND i.payment_status = @paymentStatus`;
      params.paymentStatus = filter.paymentStatus;
    }

    sql += ` ORDER BY i.id DESC LIMIT 100`;

    return db.prepare(sql).all(params);
  },
};

export { invoiceRepository };
