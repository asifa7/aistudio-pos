export interface FullSupplierRow {
  id: number;
  code: string;
  company_name: string;
  salutation?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  owner_name: string | null;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  work_phone?: string | null;
  mobile_phone?: string | null;
  whatsapp: string | null;
  email: string | null;
  category_id: number | null;
  payment_terms?: string | null;
  currency?: string | null;
  billing_address_json?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  remarks?: string | null;
  document_paths_json?: string | null;
  is_active: number;
  is_preferred: number;
  credit_limit_paise: number;
  outstanding_balance_paise: number;
  opening_balance_paise: number;
  opening_balance_date: string | null;
  preferred_payment_method: string | null;
  notes: string | null;
  tags: string | null;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierCategoryRow {
  id: number;
  name: string;
  description: string | null;
}

export interface SupplierContactRow {
  id: number;
  supplier_id: number;
  contact_name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
}

export interface SupplierAddressRow {
  id: number;
  supplier_id: number;
  address_type: 'billing' | 'shipping' | 'warehouse';
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
}

export interface SupplierBankAccountRow {
  id: number;
  supplier_id: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  upi_id: string | null;
  created_at: string;
}

export interface SupplierPaymentTermsRow {
  id: number;
  supplier_id: number;
  payment_terms_days: number;
  grace_period_days: number;
  created_at: string;
}

export interface SupplierLedgerEntryRow {
  id: number;
  supplier_id: number;
  entry_date: string;
  ref_type: 'opening_balance' | 'purchase_invoice' | 'payment' | 'purchase_return' | 'credit_note' | 'debit_note' | 'adjustment' | 'write_off';
  ref_id: number | null;
  description: string;
  debit_paise: number;
  credit_paise: number;
  running_balance_paise: number;
  created_at: string;
}

export interface SupplierPaymentRow {
  id: number;
  supplier_id: number;
  amount_paise: number;
  payment_method: 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer';
  reference_number: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  bank_name: string | null;
  payment_date: string;
  notes: string | null;
  is_advance: number;
  unallocated_amount_paise: number;
  created_by: number;
  created_at: string;
}

export interface SupplierPaymentAllocationRow {
  id: number;
  supplier_payment_id: number;
  purchase_invoice_id: number;
  allocated_amount_paise: number;
  allocated_at: string;
}

export interface PurchaseOrderRow {
  id: number;
  po_number: string;
  supplier_id: number;
  order_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'received' | 'closed' | 'cancelled';
  total_amount_paise: number;
  notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: string | null;
  revision_number: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItemRow {
  id: number;
  purchase_order_id: number;
  product_variant_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_type: 'weight' | 'piece';
  unit_price_paise: number;
  subtotal_paise: number;
  variant_name?: string;
  product_name?: string;
}

export interface GoodsReceiptRow {
  id: number;
  grn_number: string;
  purchase_order_id: number | null;
  supplier_id: number;
  delivery_note_number: string | null;
  received_date: string;
  received_by: number;
  notes: string | null;
  created_at: string;
}

export interface GoodsReceiptItemRow {
  id: number;
  goods_receipt_id: number;
  purchase_order_item_id: number | null;
  product_variant_id: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  variant_name?: string;
  product_name?: string;
}

export interface PurchaseInvoiceRow {
  id: number;
  invoice_number: string;
  supplier_invoice_number: string;
  purchase_order_id: number | null;
  goods_receipt_id: number | null;
  supplier_id: number;
  invoice_date: string;
  subtotal_paise: number;
  gst_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  freight_charges_paise: number;
  loading_charges_paise: number;
  packing_charges_paise: number;
  other_charges_paise: number;
  discount_paise: number;
  round_off_paise: number;
  total_amount_paise: number;
  outstanding_amount_paise: number;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  status?: string;
  file_path?: string;
  purchase_ref_number?: string;
  created_by: number;
  created_at: string;
}

export interface PassbookLedgerEntry {
  id: string;
  entry_date: string;
  type: 'IN' | 'OUT';
  ref_type: string;
  ref_id: number;
  purchase_ref_number?: string;
  supplier_bill_number?: string;
  supplier_id: number;
  supplier_name: string;
  description: string;
  items_summary?: string;
  amount_paise: number;
  payment_method?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  file_path?: string;
  running_balance_paise: number;
}

export interface SupplierSnapshot {
  supplier_id: number;
  company_name: string;
  outstanding_balance_paise: number;
  last_purchase_date?: string;
  last_purchase_amount_paise?: number;
  last_payment_date?: string;
  last_payment_amount_paise?: number;
}

export interface PurchasesMonthSummary {
  total_purchased_paise: number;
  total_paid_paise: number;
  total_outstanding_paise: number;
  pending_approval_count: number;
}

export interface PurchaseInvoiceItemRow {
  id: number;
  purchase_invoice_id: number;
  product_variant_id: number;
  quantity: number;
  unit_price_paise: number;
  gst_rate_bps: number;
  gst_amount_paise: number;
  total_amount_paise: number;
  variant_name?: string;
  product_name?: string;
}

export interface PurchaseReturnRow {
  id: number;
  return_number: string;
  purchase_invoice_id: number | null;
  supplier_id: number;
  return_date: string;
  reason: string | null;
  total_refund_amount_paise: number;
  resolved_via: 'refund' | 'replacement' | 'debit_note';
  created_by: number;
  created_at: string;
}

export interface PurchaseReturnItemRow {
  id: number;
  purchase_return_id: number;
  product_variant_id: number;
  quantity: number;
  unit_price_paise: number;
  gst_amount_paise: number;
  total_amount_paise: number;
  variant_name?: string;
  product_name?: string;
}

export interface SupplierAgingRow {
  supplier_id: number;
  company_name: string;
  outstanding_balance_paise: number;
  current_due_paise: number;
  overdue_30_days_paise: number;
  overdue_60_days_paise: number;
  overdue_90_days_paise: number;
}

export interface SupplierPurchaseVolumeRow {
  supplier_id: number;
  company_name: string;
  total_purchases_paise: number;
  total_invoices_count: number;
}

export function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toFixed(2);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}
