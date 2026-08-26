import { useState } from 'react';
import { FileText, ArrowLeft, Printer, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';
import { usePurchaseInvoiceDetails, useSuppliersProfile } from '../../hooks/useSupplierProcurement';
import { formatPaise, formatDate } from '../../types/supplier.types';
import SupplierPaymentDialog from '../suppliers/SupplierPaymentDialog';
import InvoiceTemplateModal, { InvoiceTemplateData } from './InvoiceTemplateModal';

interface PurchaseInvoiceDetailsProps {
  invoiceId: number;
  onBack: () => void;
}

export default function PurchaseInvoiceDetails({ invoiceId, onBack }: PurchaseInvoiceDetailsProps) {
  const { data: details, isLoading, refetch } = usePurchaseInvoiceDetails(invoiceId);
  const { data: suppliers } = useSuppliersProfile();

  // Payment dialog & invoice modal state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading invoice audit details...</div>;
  }

  if (!details) {
    return (
      <div className="p-8 text-center text-xs text-text-muted space-y-4">
        <AlertTriangle className="mx-auto text-rose-500" size={32} />
        <p>Purchase Invoice not found.</p>
        <button onClick={onBack} className="text-accent underline font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const { invoice, items } = details;
  const supplier = suppliers?.find(s => s.id === invoice.supplier_id);

  const invoiceModalData: InvoiceTemplateData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    poNumber: invoice.purchase_order_id ? `#${invoice.purchase_order_id}` : undefined,
    fromName: supplier?.company_name || `Supplier #${invoice.supplier_id}`,
    fromAddress: supplier?.phone ? `Ph: ${supplier.phone}` : undefined,
    billToName: 'Meat Shop Store',
    billToAddress: 'Main Counter / Inventory Dept',
    items: items?.map(i => ({
      qty: i.quantity,
      description: `Product Variant #${i.product_variant_id}`,
      unitPricePaise: i.unit_price_paise,
      amountPaise: i.total_amount_paise,
    })) || [],
    subtotalPaise: invoice.subtotal_paise,
    taxPaise: invoice.gst_paise,
    totalPaise: invoice.total_amount_paise,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-6">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-surface-app rounded text-text-muted hover:text-text-secondary transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-sm font-bold font-outfit text-text-secondary flex items-center gap-2">
              <FileText className="text-accent" size={16} />
              <span>Invoice #{invoice.invoice_number}</span>
            </h2>
            <p className="text-[10px] text-text-muted">Supplier: <span className="font-semibold text-text-secondary">{supplier?.company_name || `Supplier #${invoice.supplier_id}`}</span></p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
          >
            <Printer size={13} /> View & Print Styled Invoice
          </button>

          {invoice.payment_status !== 'paid' && (
            <button
              onClick={() => setShowPaymentDialog(true)}
              className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98]"
            >
              <DollarSign size={13} /> Pay Outstanding
            </button>
          )}
        </div>
      </div>

      {/* Invoice Grid Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pr-1">
        {/* Invoice Info Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent border-b border-border-subtle pb-2">Invoice Summary Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
              <div>
                <span className="text-[9px] text-text-muted uppercase">Vendor Invoice No.</span>
                <p className="text-text-secondary font-bold font-mono mt-0.5">{invoice.invoice_number}</p>
              </div>
              <div>
                <span className="text-[9px] text-text-muted uppercase">Invoice Date</span>
                <p className="text-text-secondary font-semibold mt-0.5">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <span className="text-[9px] text-text-muted uppercase">Purchase Order</span>
                <p className="text-text-secondary font-mono mt-0.5">
                  {invoice.purchase_order_id ? `#${invoice.purchase_order_id}` : 'Direct Stock Entry'}
                </p>
              </div>
              <div>
                <span className="text-[9px] text-text-muted uppercase">Goods Receipt</span>
                <p className="text-text-secondary font-mono mt-0.5">
                  {invoice.goods_receipt_id ? `GRN #${invoice.goods_receipt_id}` : 'No GRN ref'}
                </p>
              </div>
            </div>
          </div>

          {/* Items breakdown list */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-surface-app/40 border-b border-border-subtle">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Line Item Details</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-app/20 text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                  <th className="p-3">Product Variant</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Tax (GST)</th>
                  <th className="p-3 text-right pr-4">Total Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                {items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-app/20 transition-colors">
                    <td className="p-3 font-semibold text-text-secondary">Variant ID: {item.product_variant_id}</td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {item.quantity}
                    </td>
                    <td className="p-3 text-right font-mono">{formatPaise(item.unit_price_paise)}</td>
                    <td className="p-3 text-right font-mono text-text-muted">
                      {formatPaise(item.gst_amount_paise || 0)} ({((item.gst_rate_bps || 0) / 100).toFixed(1)}%)
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-text-secondary pr-4">
                      {formatPaise(item.total_amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing calculations details & payments */}
        <div className="space-y-6">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent border-b border-border-subtle pb-2">Financial Breakdown</h3>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-text-muted">Subtotal:</span>
                <span className="font-mono text-text-secondary">{formatPaise(invoice.subtotal_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">GST Tax:</span>
                <span className="font-mono text-text-secondary">{formatPaise(invoice.gst_paise ?? 0)}</span>
              </div>
              {invoice.freight_charges_paise > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Freight / Logistics:</span>
                  <span className="font-mono text-text-secondary">{formatPaise(invoice.freight_charges_paise)}</span>
                </div>
              )}
              {invoice.loading_charges_paise > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Loading Charges:</span>
                  <span className="font-mono text-text-secondary">{formatPaise(invoice.loading_charges_paise)}</span>
                </div>
              )}
              {invoice.discount_paise > 0 && (
                <div className="flex justify-between">
                  <span className="text-rose-400">Discount:</span>
                  <span className="font-mono text-rose-400">-{formatPaise(invoice.discount_paise)}</span>
                </div>
              )}
              <div className="border-t border-border-subtle pt-2 flex justify-between font-bold text-sm">
                <span className="text-text-secondary">Grand Total:</span>
                <span className="font-mono text-accent">{formatPaise(invoice.total_amount_paise)}</span>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent border-b border-border-subtle pb-2">Payment Status</h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted font-medium">Status Flag:</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border rounded ${
                  invoice.payment_status === 'unpaid'
                    ? 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                    : invoice.payment_status === 'partially_paid'
                      ? 'bg-amber-950/20 border-amber-900/50 text-amber-400'
                      : 'bg-brand-500/10 border-green-900/50 text-accent'
                }`}>
                  {invoice.payment_status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-text-muted font-medium">Owed Outstanding:</span>
                <span className="font-mono font-bold text-rose-400">{formatPaise(invoice.outstanding_amount_paise)}</span>
              </div>

              {invoice.payment_status !== 'paid' && (
                <div className="p-3 bg-surface-app border border-border-subtle rounded-lg text-[10px] text-text-muted leading-relaxed flex items-center gap-2">
                  <ShieldCheck size={14} className="text-accent flex-shrink-0" />
                  <span>Use Record Payment to allocate money to this outstanding ledger item.</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Allocations History */}
          <InvoicePaymentHistorySection invoiceId={invoice.id} />
        </div>
      </div>

      {/* Payment dialog overlay */}
      {showPaymentDialog && supplier && (
        <SupplierPaymentDialog
          supplierId={invoice.supplier_id}
          supplierName={supplier.company_name}
          outstandingBalancePaise={supplier.outstanding_balance_paise}
          onClose={() => setShowPaymentDialog(false)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      {/* Styled Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceTemplateModal
          data={invoiceModalData}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
}

import { useBillPaymentHistory } from '../../../../ledger/frontend/hooks/usePaymentEngine';

function InvoicePaymentHistorySection({ invoiceId }: { invoiceId: number }) {
  const { data: history, isLoading } = useBillPaymentHistory('purchase_invoice', invoiceId);

  if (isLoading) {
    return <div className="p-3 bg-surface-panel border border-border-subtle rounded-xl text-xs text-text-muted">Loading payments...</div>;
  }

  if (!history || history.allocations.length === 0) {
    return (
      <div className="bg-surface-panel border border-border-subtle rounded-xl p-3.5 space-y-1 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Payment History</h3>
        <p className="text-[11px] text-text-muted">No payments applied yet to this purchase invoice.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Payment History ({history.allocations.length})</h3>
        <span className="text-[10px] text-emerald-400 font-mono font-bold">
          Total Paid: ₹{((history.totalPaidPaise || 0) / 100).toFixed(2)}
        </span>
      </div>

      <div className="space-y-2">
        {history.allocations.map((alloc) => {
          const isReversed = alloc.is_reversed === 1;
          const isReversalEntry = !!alloc.reversed_payment_id;

          return (
            <div
              key={alloc.allocation_id}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                isReversed
                  ? 'bg-rose-500/5 border-rose-500/20 opacity-60'
                  : isReversalEntry
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-surface-card border-border-subtle'
              }`}
            >
              <div>
                <div className="font-mono font-bold text-text-primary flex items-center gap-1.5">
                  <span>#{alloc.voucher_number}</span>
                  <span className="text-[10px] uppercase font-semibold text-text-muted">({alloc.payment_method})</span>
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">{alloc.payment_date}</div>
                {isReversed && alloc.reversal_reason && (
                  <div className="text-[9.5px] text-rose-400 italic">Reversed: {alloc.reversal_reason}</div>
                )}
              </div>

              <div className="text-right font-mono font-bold">
                {isReversalEntry ? (
                  <span className="text-rose-400">-₹{(alloc.allocated_amount_paise / 100).toFixed(2)}</span>
                ) : (
                  <span className={isReversed ? 'line-through text-text-muted' : 'text-emerald-400'}>
                    ₹{(alloc.allocated_amount_paise / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

