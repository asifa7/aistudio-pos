import { useRef } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { PaymentReceiptVoucher } from '../hooks/usePaymentEngine';

interface VoucherPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: PaymentReceiptVoucher | null;
}

export default function VoucherPrintModal({ isOpen, onClose, voucher }: VoucherPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPayment = voucher.direction === 'payment';
  const amountRupees = (voucher.amount_paise / 100).toFixed(2);
  const unallocatedRupees = (voucher.unallocated_amount_paise / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isPayment ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              <FileText size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">
                {isPayment ? 'Payment Voucher' : 'Receipt Voucher'}
              </h2>
              <p className="text-xs text-text-muted font-mono">{voucher.voucher_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Printer size={14} /> Print Voucher
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Voucher Preview Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={printRef}
            className="p-6 bg-white text-black rounded-xl border border-gray-200 shadow-sm font-sans space-y-4 text-xs"
          >
            {/* Store Banner */}
            <div className="text-center border-b border-gray-200 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">MEAT SHOP POS</h3>
              <p className="text-[11px] text-gray-600">Fresh Meat & Poultry Wholesale / Retail</p>
              <div className="font-bold text-xs mt-1 uppercase tracking-wider text-gray-800">
                {isPayment ? 'OFFICIAL PAYMENT VOUCHER' : 'OFFICIAL RECEIPT VOUCHER'}
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-500 block">Voucher No:</span>
                <strong className="font-mono text-gray-900">{voucher.voucher_number}</strong>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block">Date:</span>
                <strong className="font-mono text-gray-900">{voucher.payment_date}</strong>
              </div>
              <div>
                <span className="text-gray-500 block">Party / Account:</span>
                <strong className="text-gray-900">{voucher.party_name || voucher.category || 'General'}</strong>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block">Payment Method:</span>
                <strong className="uppercase text-gray-900">{voucher.payment_method}</strong>
              </div>
            </div>

            {/* Amount Box */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-gray-700">Amount:</span>
              <span className="font-mono text-base font-extrabold text-gray-900">₹{amountRupees}</span>
            </div>

            {/* Allocated Bills Breakdown */}
            {voucher.allocations && voucher.allocations.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-gray-200">
                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-600 block">
                  Bill Allocations / Settlements:
                </span>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 font-semibold">
                      <th className="py-1">Bill Reference</th>
                      <th className="py-1 text-right">Settled Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {voucher.allocations.map(a => (
                      <tr key={a.id}>
                        <td className="py-1 font-mono text-gray-800">{a.bill_number}</td>
                        <td className="py-1 text-right font-mono font-bold text-gray-900">
                          ₹{(a.allocated_amount_paise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Advance / Unallocated */}
            {voucher.unallocated_amount_paise > 0 && (
              <div className="flex items-center justify-between text-[11px] text-gray-600 border-t border-gray-100 pt-1.5">
                <span>On-Account Advance Balance:</span>
                <span className="font-mono font-bold">₹{unallocatedRupees}</span>
              </div>
            )}

            {/* Narration */}
            {voucher.narration && (
              <div className="pt-2 border-t border-gray-200 text-[11px]">
                <span className="text-gray-500">Narration / Notes: </span>
                <span className="italic text-gray-800">{voucher.narration}</span>
              </div>
            )}

            {/* Signature Strip */}
            <div className="grid grid-cols-2 gap-4 pt-8 text-[11px] border-t border-gray-200">
              <div className="text-center border-t border-gray-300 pt-1 text-gray-600">
                Prepared By ({voucher.created_by_name || 'Cashier'})
              </div>
              <div className="text-center border-t border-gray-300 pt-1 text-gray-600">
                Receiver's Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
