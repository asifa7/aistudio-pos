import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Receipt, Printer, User, Calendar, Clock, CreditCard, ShieldCheck } from 'lucide-react';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { formatPaise, formatDate } from '../../../customers/frontend/types/customer.types';

interface TransactionDetailModalProps {
  invoiceId: number | null;
  onClose: () => void;
}

export default function TransactionDetailModal({ invoiceId, onClose }: TransactionDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['invoice-drilldown-detail', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const res = await window.api.invoke(IPC_CHANNELS.BILLING.GET_INVOICE, { invoice_id: invoiceId });
      if (!res.success) throw new Error(res.error?.message || 'Failed to load invoice details');
      return res.data;
    },
    enabled: Boolean(invoiceId),
  });

  if (!invoiceId) return null;

  const invoice = data?.invoice || data;
  const items = data?.items || [];
  const payments = data?.payments || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-card/80 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-brand-500" />
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Transaction Detail: {invoice?.invoice_number || `#${invoiceId}`}
              </h3>
              <p className="text-[10px] text-text-muted">
                Completed on {invoice?.completed_at ? formatDate(invoice.completed_at) : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-surface-card hover:bg-surface-panel border border-border-subtle rounded-lg font-bold text-xs text-text-primary flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-surface-hover rounded-full text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-surface-card">
          {isLoading ? (
            <div className="py-16 text-center text-text-muted">Loading transaction records...</div>
          ) : (
            <>
              {/* Summary Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-panel border border-border-subtle rounded-xl p-4">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Customer</span>
                  <p className="font-bold text-text-primary mt-0.5">{invoice?.customer_name || 'Walk-in Customer'}</p>
                  {invoice?.customer_phone && (
                    <p className="text-[10px] font-mono text-text-secondary">{invoice.customer_phone}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Payment Method</span>
                  <p className="font-bold text-text-primary uppercase mt-0.5">
                    {payments.length > 0 ? payments.map((p: any) => p.method).join(', ') : (invoice?.payment_status || 'Cash')}
                  </p>
                  {payments.length > 0 && payments[0].reference_number && (
                    <p className="text-[10px] font-mono text-text-secondary">Ref: {payments[0].reference_number}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Cashier</span>
                  <p className="font-bold text-text-primary mt-0.5">{invoice?.created_by_name || 'Admin'}</p>
                  <p className="text-[10px] text-text-secondary">Shift: {invoice?.shift_id || 1}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Total Net Amount</span>
                  <p className="font-mono text-base font-extrabold text-brand-600 dark:text-brand-400 mt-0.5">
                    {formatPaise(invoice?.total_paise || 0)}
                  </p>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-panel border-b border-border-subtle text-text-secondary text-[11px]">
                      <th className="py-2.5 px-3 font-bold">#</th>
                      <th className="py-2.5 px-3 font-bold">Item & Variant</th>
                      <th className="py-2.5 px-3 font-bold">Qty / Wt</th>
                      <th className="py-2.5 px-3 text-right font-bold">Rate</th>
                      <th className="py-2.5 px-3 text-right font-bold">Discount</th>
                      <th className="py-2.5 px-3 text-right font-bold">Tax</th>
                      <th className="py-2.5 px-3 text-right font-bold text-text-primary">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-text-primary bg-surface-card">
                    {items.map((item: any, idx: number) => {
                      const qtyStr = item.quantity_grams
                        ? `${(item.quantity_grams / 1000).toFixed(3)} kg`
                        : `${item.quantity_units} pcs`;
                      const taxPaise = (item.line_total_paise || 0) - (item.line_subtotal_paise || 0);

                      return (
                        <tr key={item.id || idx} className="hover:bg-surface-hover">
                          <td className="py-2.5 px-3 font-mono text-text-muted">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold block">{item.product_name || item.variant_name}</span>
                            {item.sku && <span className="text-[10px] font-mono text-text-muted">{item.sku}</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold">{qtyStr}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatPaise(item.rate_paise_snapshot || 0)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                            {item.discount_paise ? `-${formatPaise(item.discount_paise)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                            {taxPaise > 0 ? formatPaise(taxPaise) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-text-primary">
                            {formatPaise(item.line_total_paise || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 bg-surface-panel border border-border-subtle rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-bold">{formatPaise(invoice?.subtotal_paise || 0)}</span>
                  </div>
                  {invoice?.discount_paise > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatPaise(invoice.discount_paise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>CGST + SGST:</span>
                    <span className="font-mono">{formatPaise(invoice?.tax_paise || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-text-primary border-t border-border-subtle pt-2">
                    <span>Total Paid:</span>
                    <span className="font-mono text-brand-600 dark:text-brand-400">
                      {formatPaise(invoice?.total_paise || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
