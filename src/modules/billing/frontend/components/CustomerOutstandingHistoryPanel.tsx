// src/modules/billing/frontend/components/CustomerOutstandingHistoryPanel.tsx
// Small, self-contained bottom panel showing customer's current outstanding balance & last 3-5 purchases.
// Only renders when a customer is selected; renders null if no customer is selected.

import React from 'react';
import { Clock, AlertCircle, CheckCircle2, ShoppingBag, Receipt } from 'lucide-react';
import { Customer } from '../../../customers/frontend/types/customer.types';
import { useCustomerPurchaseHistory } from '../../../customers/frontend/hooks/useCustomers';

interface CustomerOutstandingHistoryPanelProps {
  customer: Customer | null | undefined;
}

export const CustomerOutstandingHistoryPanel: React.FC<CustomerOutstandingHistoryPanelProps> = ({ customer }) => {
  // If no customer is selected, do not render anything (no empty box, no placeholder)
  if (!customer) {
    return null;
  }

  const customerId = customer.id;
  const { data: purchaseHistory, isLoading } = useCustomerPurchaseHistory(customerId, 4);
  const recentInvoices = purchaseHistory?.invoices || [];

  const outstandingPaise = customer.outstanding_balance_paise || 0;
  const advancePaise = customer.advance_balance_paise || 0;
  const hasOutstanding = outstandingPaise > 0;
  const hasAdvance = advancePaise > 0;

  return (
    <div className="border-t border-border-subtle bg-surface-panel p-2.5 flex-shrink-0 animate-in fade-in duration-150 select-none">
      <div className="flex flex-col gap-2">
        {/* Outstanding / Advance Status Row */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
              {customer.name}'s Account:
            </span>
            {hasOutstanding ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
                <AlertCircle size={11} />
                Outstanding: ₹{(outstandingPaise / 100).toFixed(2)}
              </span>
            ) : hasAdvance ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-500/15 text-brand-400 border border-brand-500/30">
                <CheckCircle2 size={11} />
                Advance Credit: ₹{(advancePaise / 100).toFixed(2)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 size={11} />
                All Paid (₹0.00 Due)
              </span>
            )}
          </div>

          <div className="text-[10px] text-text-muted font-bold flex items-center gap-1">
            <Clock size={11} />
            <span>Recent History</span>
          </div>
        </div>

        {/* Last Purchases List (3-4 items max, compact row) */}
        {isLoading ? (
          <div className="text-[10px] text-text-muted py-1 text-center">Loading purchase history...</div>
        ) : recentInvoices.length === 0 ? (
          <div className="text-[10px] text-text-muted py-1 px-1 italic">
            No previous purchase history found for this customer.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {recentInvoices.map((inv) => {
              const invDate = inv.created_at ? new Date(inv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
              const invAmt = ((inv.total_paise || 0) / 100).toFixed(2);
              const invNo = inv.invoice_number ? `#${inv.invoice_number.split('_')[0]}` : `#${inv.id}`;
              const isPaid = inv.payment_status === 'paid';

              return (
                <div
                  key={inv.id}
                  className="bg-surface-card border border-border-subtle/80 rounded-lg p-1.5 flex flex-col justify-between text-[10px]"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-extrabold text-brand-400">{invNo}</span>
                    <span className="text-text-muted text-[9px]">{invDate}</span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="font-black text-text-primary">₹{invAmt}</span>
                    <span
                      className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded ${
                        isPaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Due'}
                    </span>
                  </div>

                  {inv.items_summary && (
                    <div className="text-[9px] text-text-muted truncate mt-0.5" title={inv.items_summary}>
                      {inv.items_summary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOutstandingHistoryPanel;
