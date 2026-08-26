import React, { useState } from 'react';
import { CreditCard, Banknote, Smartphone, SplitSquareVertical, X, CheckCircle2 } from 'lucide-react';
import { formatPaise } from '../../../customers/frontend/types/customer.types';
import { usePOSShortcutsStore, formatKeyLabel, isKeyMatch } from '../hooks/usePOSShortcutsStore';

interface PaymentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  totalPaise: number;
  onRecordPayment: (method: 'cash' | 'upi' | 'card' | 'split' | 'credit', amountPaise: number, referenceNumber?: string | null) => Promise<void>;
  onComplete: () => Promise<void>;
  paidAmount: number;
}

type PaymentMethod = 'cash' | 'upi' | 'card';

interface SplitEntry {
  method: PaymentMethod;
  amountRupees: string;
  reference: string;
}

export default function PaymentPanel({ isOpen, onClose, totalPaise, onRecordPayment, onComplete, paidAmount }: PaymentPanelProps) {
  const [mode, setMode] = useState<'single' | 'split'>('single');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [splitEntries, setSplitEntries] = useState<SplitEntry[]>([
    { method: 'cash', amountRupees: '', reference: '' },
    { method: 'upi', amountRupees: '', reference: '' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');



  const { shortcuts } = usePOSShortcutsStore();

  if (!isOpen) return null;

  const remainingPaise = totalPaise - paidAmount;
  const remainingRupees = (remainingPaise / 100).toFixed(2);

  const methods: { key: PaymentMethod; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { key: 'cash', label: 'Cash', icon: <Banknote size={16} />, shortcut: formatKeyLabel(shortcuts.cash) },
    { key: 'upi', label: 'UPI', icon: <Smartphone size={16} />, shortcut: formatKeyLabel(shortcuts.upi) },
    { key: 'card', label: 'Card', icon: <CreditCard size={16} />, shortcut: formatKeyLabel(shortcuts.card) },
  ];

  const handleSinglePayment = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      await onRecordPayment(selectedMethod, remainingPaise, reference || null);
      await onComplete();
    } catch (err: any) {
      console.error('Single payment error:', err);
      setPaymentError(err?.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplitPayment = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      for (const entry of splitEntries) {
        const amountPaise = Math.round(parseFloat(entry.amountRupees || '0') * 100);
        if (amountPaise > 0) {
          await onRecordPayment(entry.method, amountPaise, entry.reference || null);
        }
      }
      await onComplete();
    } catch (err: any) {
      console.error('Split payment error:', err);
      setPaymentError(err?.message || 'Split payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const splitTotal = splitEntries.reduce((sum, e) => sum + Math.round(parseFloat(e.amountRupees || '0') * 100), 0);
  const splitValid = splitTotal >= remainingPaise;

  const updateSplitEntry = (index: number, field: keyof SplitEntry, value: string) => {
    setSplitEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      if (isKeyMatch(e, shortcuts.cash)) {
        setMode('single');
        setSelectedMethod('cash');
      } else if (isKeyMatch(e, shortcuts.upi)) {
        setMode('single');
        setSelectedMethod('upi');
      } else if (isKeyMatch(e, shortcuts.card)) {
        setMode('single');
        setSelectedMethod('card');
      } else if (isKeyMatch(e, shortcuts.split)) {
        setMode('split');
      } else if (isKeyMatch(e, shortcuts.checkout) || e.key === 'Enter' || e.code === 'Enter') {
        e.preventDefault();
        if (mode === 'single') handleSinglePayment();
        else if (splitValid) handleSplitPayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, selectedMethod, splitValid, handleSinglePayment, handleSplitPayment, shortcuts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="bg-surface-card rounded-xl shadow-elevation border border-border-subtle w-[480px] overflow-hidden">
        {/* Header */}
        <div className="bg-surface-panel px-5 py-3.5 flex items-center justify-between border-b border-border-subtle">
          <div>
            <p className="text-text-primary font-bold text-sm">Complete Payment</p>
            <p className="text-text-muted text-[10px]">Total: {formatPaise(totalPaise)} | Remaining: {formatPaise(remainingPaise)}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {paymentError && (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-lg text-xs font-semibold text-red-400">
              {paymentError}
            </div>
          )}

          {/* Amount Display */}
          <div className="text-center bg-surface-panel rounded-lg p-4 border border-border-subtle">
            <p className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Amount Due</p>
            <p className="text-3xl font-bold font-mono text-brand-500 mt-1">₹{remainingRupees}</p>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === 'single'
                  ? 'bg-brand-500 text-white shadow-subtle'
                  : 'bg-surface-panel border border-border-subtle text-text-secondary hover:bg-surface-hover'
              }`}
            >
              Single Payment
            </button>
            <button
              onClick={() => setMode('split')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'split'
                  ? 'bg-brand-500 text-white shadow-subtle'
                  : 'bg-surface-panel border border-border-subtle text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <SplitSquareVertical size={14} />
              Split Payment
              <kbd className="ml-1.5 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded text-text-muted leading-none">{formatKeyLabel(shortcuts.split)}</kbd>
            </button>
          </div>

          {/* Single Payment */}
          {mode === 'single' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {methods.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMethod(m.key)}
                    className={`py-3 rounded-lg text-xs font-bold flex flex-col items-center gap-1.5 transition-all border ${
                      selectedMethod === m.key
                        ? 'bg-brand-500/10 border-brand-500 text-brand-500 shadow-subtle'
                        : 'bg-surface-panel border-border-subtle text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {m.icon}
                    <div className="flex items-center gap-1.5">
                      {m.label}
                      <kbd className={`px-1.5 py-0.5 text-[9px] font-mono font-bold border rounded leading-none ${selectedMethod === m.key ? 'bg-brand-500/20 border-brand-500/40 text-brand-600 dark:text-brand-400' : 'bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-text-muted'}`}>{m.shortcut}</kbd>
                    </div>
                  </button>
                ))}
              </div>

              {selectedMethod === 'cash' && (
                <div className="space-y-2 bg-surface-panel p-3 rounded-lg border border-border-subtle">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider flex items-center justify-between">
                      <span>Cash Given / Tendered (Optional)</span>
                      {cashGiven && !isNaN(parseFloat(cashGiven)) && (
                        <span className="text-[9px] text-text-muted">Type amount received</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                      <input
                        type="number"
                        step="any"
                        value={cashGiven}
                        onChange={e => setCashGiven(e.target.value)}
                        placeholder={(remainingPaise / 100).toFixed(2)}
                        className="w-full bg-surface-card border border-border-subtle rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500 font-bold"
                      />
                    </div>
                  </div>

                  {cashGiven !== '' && !isNaN(parseFloat(cashGiven)) && (
                    <div className="pt-1">
                      {parseFloat(cashGiven) >= remainingPaise / 100 ? (
                        <div className="flex items-center justify-between p-2 bg-brand-500/10 border border-brand-500/30 rounded-md text-xs font-extrabold text-brand-500">
                          <span>Change to Return:</span>
                          <span className="font-mono text-sm">₹{(parseFloat(cashGiven) - (remainingPaise / 100)).toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 bg-amber-950/40 border border-amber-800/40 rounded-md text-xs font-semibold text-amber-400">
                          <span>⚠️ Insufficient amount</span>
                          <span className="font-mono text-[11px]">Short by ₹{((remainingPaise / 100) - parseFloat(cashGiven)).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedMethod !== 'cash' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Reference Number</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Transaction ID / UTR"
                    className="w-full bg-surface-panel border border-border-subtle rounded-lg px-4 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              )}

              <button
                onClick={handleSinglePayment}
                disabled={isProcessing || remainingPaise <= 0}
                className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {isProcessing ? 'Processing...' : `Pay ${formatPaise(remainingPaise)} via ${selectedMethod.toUpperCase()}`}
              </button>
            </div>
          )}

          {/* Split Payment */}
          {mode === 'split' && (
            <div className="space-y-3">
              {splitEntries.map((entry, idx) => (
                <div key={idx} className="bg-surface-panel rounded-lg p-3 border border-border-subtle space-y-2">
                  <div className="flex gap-2">
                    {methods.map(m => (
                      <button
                        key={m.key}
                        onClick={() => updateSplitEntry(idx, 'method', m.key)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all border ${
                          entry.method === m.key
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-surface-card border-border-subtle text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.amountRupees}
                      onChange={e => updateSplitEntry(idx, 'amountRupees', e.target.value)}
                      placeholder="₹ Amount"
                      className="flex-1 bg-surface-card border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    />
                    {entry.method !== 'cash' && (
                      <input
                        type="text"
                        value={entry.reference}
                        onChange={e => updateSplitEntry(idx, 'reference', e.target.value)}
                        placeholder="Ref #"
                        className="w-28 bg-surface-card border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                      />
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between text-xs font-medium">
                <span className={splitValid ? 'text-brand-500' : 'text-red-400'}>
                  Split Total: {formatPaise(splitTotal)} / {formatPaise(remainingPaise)}
                </span>
                <button
                  onClick={() => setSplitEntries(prev => [...prev, { method: 'cash', amountRupees: '', reference: '' }])}
                  className="text-blue-400 hover:text-blue-300 font-bold text-[10px]"
                >
                  + Add Method
                </button>
              </div>

              <button
                onClick={handleSplitPayment}
                disabled={isProcessing || !splitValid}
                className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {isProcessing ? 'Processing...' : 'Complete Split Payment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
