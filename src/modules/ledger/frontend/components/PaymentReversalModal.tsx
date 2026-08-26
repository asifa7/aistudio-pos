import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useReversePayment, PaymentReceiptVoucher } from '../hooks/usePaymentEngine';

interface PaymentReversalModalProps {
  voucher: PaymentReceiptVoucher | { id: number; voucher_number: string; amount_paise: number; party_name?: string } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentReversalModal({ voucher, onClose, onSuccess }: PaymentReversalModalProps) {
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const reverseMutation = useReversePayment();

  if (!voucher) return null;

  const amountRupees = (voucher.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please enter a valid mandatory reason explaining this reversal.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await reverseMutation.mutateAsync({
        payment_receipt_id: voucher.id,
        reason: reason.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reverse payment voucher');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <RotateCcw size={18} />
            <span>Reverse Payment Voucher</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {/* Warning Banner */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Immutable Audit Trail Protection</div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                This payment record will <strong>not be deleted</strong>. Instead, an official linked reversal entry will be created, restoring the bill&apos;s outstanding balance and supplier account.
              </p>
            </div>
          </div>

          {/* Voucher Details Card */}
          <div className="p-3.5 bg-surface-panel rounded-xl border border-border-subtle space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Voucher Ref:</span>
              <span className="font-mono font-bold text-brand-400">#{voucher.voucher_number}</span>
            </div>
            {voucher.party_name && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Party:</span>
                <span className="font-bold text-text-primary">{voucher.party_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
              <span className="text-text-muted">Reversal Amount:</span>
              <span className="font-mono font-black text-rose-400 text-sm">₹{amountRupees}</span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-rose-400" />
              <span>Mandatory Reversal Reason *</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Wrong bill selected / duplicate entry / amount correction..."
              required
              autoFocus
              className="w-full bg-surface-panel border border-border-subtle rounded-xl p-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-rose-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-rose-500/20 flex items-center gap-1.5"
            >
              <RotateCcw size={13} className={isSubmitting ? 'animate-spin' : ''} />
              <span>{isSubmitting ? 'Processing Reversal...' : 'Confirm Reversal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
