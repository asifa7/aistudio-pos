import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, CheckCircle, Wallet, Landmark } from 'lucide-react';
import { useRecordContraEntry, useLiquidBalances } from '../hooks/usePaymentEngine';

interface ContraTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContraTransferModal({ isOpen, onClose }: ContraTransferModalProps) {
  const recordContra = useRecordContraEntry();
  const { data: balances } = useLiquidBalances();

  const [fromAccount, setFromAccount] = useState<'cash' | 'bank'>('cash');
  const [toAccount, setToAccount] = useState<'cash' | 'bank'>('bank');
  const [amountRupees, setAmountRupees] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSwap = () => {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amt = parseFloat(amountRupees);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid transfer amount');
      return;
    }

    if (fromAccount === toAccount) {
      setError('Source and destination accounts must be different');
      return;
    }

    try {
      const res = await recordContra.mutateAsync({
        from_account: fromAccount,
        to_account: toAccount,
        amount_paise: Math.round(amt * 100),
        entry_date: entryDate,
        narration: narration.trim() || undefined,
      });

      setSuccess(`Contra transfer recorded (${res.voucherNumber})!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to record contra transfer');
    }
  };

  const cashInHandRupees = ((balances?.cashInHandPaise || 0) / 100).toFixed(2);
  const bankBalanceRupees = ((balances?.bankBalancePaise || 0) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Contra Transfer (Cash ⇄ Bank)</h2>
              <p className="text-xs text-text-muted">Transfer money between shop cash drawer and bank accounts.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Live Balance Context Strip */}
        <div className="p-3.5 bg-surface-app border-b border-border-subtle grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-surface-panel rounded-xl border border-border-subtle flex items-center gap-2.5">
            <Wallet size={16} className="text-amber-400" />
            <div>
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Cash in Hand</span>
              <span className="font-bold font-mono text-text-primary">₹{cashInHandRupees}</span>
            </div>
          </div>
          <div className="p-2.5 bg-surface-panel rounded-xl border border-border-subtle flex items-center gap-2.5">
            <Landmark size={16} className="text-cyan-400" />
            <div>
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Bank Balance</span>
              <span className="font-bold font-mono text-text-primary">₹{bankBalanceRupees}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Transfer From *</label>
              <select
                value={fromAccount}
                onChange={e => setFromAccount(e.target.value as any)}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank Account</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              className="mt-5 p-2 rounded-xl bg-surface-app hover:bg-surface-card border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
              title="Swap accounts"
            >
              <ArrowRightLeft size={16} />
            </button>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Transfer To *</label>
              <select
                value={toAccount}
                onChange={e => setToAccount(e.target.value as any)}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                <option value="bank">Bank Account</option>
                <option value="cash">Cash in Hand</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Transfer Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="₹ 0.00"
                value={amountRupees}
                onChange={e => setAmountRupees(e.target.value)}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-sm font-mono font-bold text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Entry Date *</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Narration / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Cash deposit to HDFC, register float withdrawal"
              value={narration}
              onChange={e => setNarration(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300">
            Note: Contra entries only adjust internal shop balances and will never alter supplier or customer ledgers.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border-subtle text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordContra.isPending}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              {recordContra.isPending ? 'Recording...' : 'Execute Contra Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
