import { useState } from 'react';
import { X, History, FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { useBillPaymentHistory, OutstandingPurchaseBill } from '../hooks/usePaymentEngine';
import PaymentReversalModal from './PaymentReversalModal';

interface BillHistoryModalProps {
  bill: OutstandingPurchaseBill | null;
  onClose: () => void;
  onPaymentReversed?: () => void;
}

export default function BillHistoryModal({ bill, onClose, onPaymentReversed }: BillHistoryModalProps) {
  const [selectedVoucherForReversal, setSelectedVoucherForReversal] = useState<any | null>(null);

  const { data: historyData, isLoading, refetch } = useBillPaymentHistory(
    'purchase_invoice',
    bill?.id
  );

  if (!bill) return null;

  const totalBillRupees = (bill.total_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const paidRupees = ((historyData?.totalPaidPaise || bill.paid_amount_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const outstandingRupees = Math.max(0, (bill.total_amount_paise - (historyData?.totalPaidPaise || 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel shrink-0">
          <div className="flex items-center gap-2 text-brand-400 font-bold">
            <History size={18} />
            <span>Bill Payment History & Audit Trail</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Bill Summary Banner */}
        <div className="p-4 bg-surface-panel border-b border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-[10.5px] font-bold text-text-muted uppercase">Bill / Invoice #</span>
            <div className="font-mono font-bold text-text-primary mt-0.5 truncate">
              {bill.supplier_invoice_number || bill.purchase_ref_number || bill.invoice_number}
            </div>
            <div className="text-[10px] text-text-muted">{bill.invoice_date}</div>
          </div>

          <div>
            <span className="text-[10.5px] font-bold text-text-muted uppercase">Supplier</span>
            <div className="font-bold text-text-primary mt-0.5 truncate">{bill.supplier_company || bill.supplier_name}</div>
          </div>

          <div>
            <span className="text-[10.5px] font-bold text-text-muted uppercase">Total Bill / Paid</span>
            <div className="font-mono font-bold text-text-primary mt-0.5">
              ₹{totalBillRupees}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">Paid: ₹{paidRupees}</div>
          </div>

          <div>
            <span className="text-[10.5px] font-bold text-text-muted uppercase">Live Outstanding</span>
            <div className="font-mono font-black text-rose-400 mt-0.5 text-sm">
              ₹{outstandingRupees}
            </div>
          </div>
        </div>

        {/* History Table Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="text-xs font-bold text-text-secondary flex items-center justify-between">
            <span>Payment Vouchers Applied ({historyData?.allocations?.length || 0})</span>
            <span className="text-[10.5px] text-text-muted">Live audit trail — payments are immutable</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">Loading payment allocations...</div>
          ) : !historyData || historyData.allocations.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-border-subtle rounded-xl p-6">
              <FileText size={28} className="mx-auto text-text-muted/40" />
              <div className="text-xs font-bold text-text-secondary">No Payments Recorded Yet</div>
              <p className="text-[11px] text-text-muted">No payment voucher has been applied to this purchase bill.</p>
            </div>
          ) : (
            <div className="border border-border-subtle rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {historyData.allocations.map((alloc) => {
                    const isReversed = alloc.is_reversed === 1;
                    const isReversalEntry = !!alloc.reversed_payment_id;
                    const allocRupees = (alloc.allocated_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

                    return (
                      <tr key={alloc.allocation_id} className={`hover:bg-surface-hover/50 ${isReversed ? 'opacity-60 bg-surface-card/40' : ''}`}>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-brand-400">#{alloc.voucher_number}</span>
                          {alloc.narration && (
                            <div className="text-[10px] text-text-muted truncate max-w-[150px]">{alloc.narration}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-[11px]">{alloc.payment_date}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-text-muted">{alloc.payment_method}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                          {isReversalEntry ? <span className="text-rose-400">-₹{allocRupees}</span> : `₹${allocRupees}`}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isReversed ? (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Reversed
                            </span>
                          ) : isReversalEntry ? (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Reversal Entry
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit mx-auto">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          {!isReversed && !isReversalEntry && (
                            <button
                              onClick={() => setSelectedVoucherForReversal({
                                id: alloc.voucher_id,
                                voucher_number: alloc.voucher_number,
                                amount_paise: alloc.allocated_amount_paise,
                                party_name: bill.supplier_company || bill.supplier_name,
                              })}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 ml-auto border border-rose-500/20"
                              title="Create linked reversal entry"
                            >
                              <RotateCcw size={11} /> Reverse
                            </button>
                          )}
                          {isReversed && alloc.reversal_reason && (
                            <span className="text-[10px] text-text-muted italic" title={alloc.reversal_reason}>
                              Reason: {alloc.reversal_reason.slice(0, 18)}...
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface-panel border-t border-border-subtle flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {selectedVoucherForReversal && (
        <PaymentReversalModal
          voucher={selectedVoucherForReversal}
          onClose={() => setSelectedVoucherForReversal(null)}
          onSuccess={() => {
            refetch();
            if (onPaymentReversed) onPaymentReversed();
          }}
        />
      )}
    </div>
  );
}
