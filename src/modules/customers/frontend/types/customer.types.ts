// customer.types.ts
// Frontend-safe type definitions for Customer A/R module

export interface CustomerGroup {
  id: number;
  name: string;
  description: string | null;
  default_credit_limit_paise: number;
  default_discount_percent: number;
}

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  business_name: string | null;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  phone2: string | null;
  whatsapp: string | null;
  email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_pincode: string | null;
  delivery_notes: string | null;
  group_id: number | null;
  group_name: string | null;
  category: CustomerCategory;
  is_active: number;
  credit_allowed: number;
  credit_limit_paise: number;
  outstanding_balance_paise: number;
  advance_balance_paise: number;
  opening_balance_paise: number;
  opening_balance_date: string | null;
  preferred_payment_method: PaymentMethodType;
  preferred_delivery_time: string | null;
  price_tier: PriceTier;
  discount_percent: number;
  notes: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export type CustomerCategory =
  | 'Hotel'
  | 'Restaurant'
  | 'Retail'
  | 'Wholesale'
  | 'Catering'
  | 'Distributor'
  | 'Contract';

export type PaymentMethodType =
  | 'cash'
  | 'upi'
  | 'card'
  | 'bank_transfer'
  | 'cheque'
  | 'credit'
  | 'advance_adjustment';

export type PriceTier = 'standard' | 'wholesale' | 'vip';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CreditAccount {
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
  is_blacklisted: number;
  blacklist_reason: string | null;
}

export interface LedgerEntry {
  id: number;
  customer_id: number;
  entry_date: string;
  ref_type: LedgerRefType;
  ref_id: number | null;
  invoice_number: string | null;
  description: string;
  debit_paise: number;
  credit_paise: number;
  running_balance_paise: number;
  created_by: number | null;
  created_at: string;
}

export type LedgerRefType =
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

export interface CustomerPayment {
  id: number;
  customer_id: number;
  amount_paise: number;
  method: PaymentMethodType;
  reference_number: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  bank_name: string | null;
  payment_date: string;
  notes: string | null;
  is_advance: number;
  is_allocated: number;
  unallocated_paise: number;
  created_at: string;
}

export interface CreditTransaction {
  id: number;
  customer_id: number;
  invoice_id: number | null;
  transaction_type: string;
  amount_paise: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreditNote {
  id: number;
  credit_note_number: string;
  customer_id: number;
  original_invoice_id: number | null;
  amount_paise: number;
  reason: string;
  is_applied: number;
  applied_to_invoice_id: number | null;
  applied_at: string | null;
  created_at: string;
}

export interface AgingReportRow {
  customer_id: number;
  customer_code: string;
  name: string;
  phone: string | null;
  outstanding_paise: number;
  current_paise: number;
  days_1_30_paise: number;
  days_31_60_paise: number;
  days_61_90_paise: number;
  days_91_180_paise: number;
  days_180_plus_paise: number;
  last_payment_date: string | null;
  credit_limit_paise: number;
  available_credit_paise: number;
  risk_level: RiskLevel;
}

export interface CustomerStatement {
  customer: Customer;
  opening_balance_paise: number;
  entries: LedgerEntry[];
  closing_balance_paise: number;
  total_debits_paise: number;
  total_credits_paise: number;
  startDate: string;
  endDate: string;
}

export interface CreditValidationResult {
  allowed: boolean;
  requiresOverride: boolean;
  message: string;
  outstanding_paise: number;
  credit_limit_paise: number;
  available_credit_paise: number;
}

export interface ActivityLog {
  id: number;
  customer_id: number;
  action: string;
  details: string | null;
  performed_by: number | null;
  created_at: string;
}

export interface CustomerReminder {
  id: number;
  customer_id: number;
  channel: 'sms' | 'whatsapp' | 'email' | 'manual';
  template_type: 'payment_due' | 'overdue' | 'credit_limit' | 'custom';
  message: string;
  outstanding_paise: number | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface UnpaidInvoice {
  id: number;
  invoice_number: string | null;
  total_paise: number;
  remaining_paise: number;
  completed_at: string | null;
  payment_status: string;
  days_overdue: number;
}

// ─── Formatting Helpers ──────────────────────────────────────

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getCategoryBadgeColor(category: CustomerCategory): string {
  const map: Record<CustomerCategory, string> = {
    Hotel: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Restaurant: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    Retail: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Wholesale: 'bg-brand-500/20 text-brand-500 border-brand-500/50',
    Catering: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    Distributor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    Contract: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };
  return map[category] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

export function getRiskBadgeColor(risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: 'bg-brand-500/20 text-brand-500',
    medium: 'bg-yellow-500/20 text-yellow-300',
    high: 'bg-red-500/20 text-red-300',
  };
  return map[risk];
}

export function getLedgerRefLabel(refType: LedgerRefType): string {
  const map: Record<LedgerRefType, string> = {
    opening_balance: 'Opening Balance',
    invoice: 'Credit Sale',
    payment: 'Payment Received',
    advance_deposit: 'Advance Deposit',
    advance_applied: 'Advance Applied',
    credit_note: 'Credit Note',
    debit_note: 'Debit Note',
    adjustment: 'Manual Adjustment',
    write_off: 'Write-Off',
    interest: 'Interest Charged',
    refund: 'Refund',
  };
  return map[refType] ?? refType;
}

export function getPaymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    credit: 'Credit',
    advance_adjustment: 'Advance Adjustment',
  };
  return map[method] ?? method;
}

export function getDaysOverdue(completedAt: string | null): number {
  if (!completedAt) return 0;
  const diff = Date.now() - new Date(completedAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
