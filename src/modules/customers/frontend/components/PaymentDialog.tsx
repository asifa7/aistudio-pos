import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Check } from 'lucide-react';
import { useRecordCustomerPayment } from '../hooks/useCustomerCredit';
import type { Customer, PaymentMethodType } from '../types/customer.types';
import { formatPaise } from '../types/customer.types';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export default function PaymentDialog({ isOpen, onClose, customer }: PaymentDialogProps) {
  const [amountRupees, setAmountRupees] = useState('');
  const [method, setMethod] = useState<PaymentMethodType>('cash');
  const [reference, setReference] = useState('');
  
  // Cheque details
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const recordPayment = useRecordCustomerPayment();

  useEffect(() => {
    setAmountRupees('');
    setMethod('cash');
    setReference('');
    setChequeNo('');
    setChequeDate('');
    setBankName('');
    setNotes('');
    setError('');
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const outstandingRupees = customer.outstanding_balance_paise / 100;
  const paymentAmountPaise = Math.round(parseFloat(amountRupees || '0') * 100);
  const excessPaise = Math.max(0, paymentAmountPaise - customer.outstanding_balance_paise);

  const handlePreset = (rupees: number) => {
    setAmountRupees(String(rupees));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmountPaise <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordPayment.mutateAsync({
        customer_id: customer.id,
        amount_paise: paymentAmountPaise,
        method,
        reference_number: reference || null,
        cheque_number: chequeNo || null,
        cheque_date: chequeDate || null,
        bank_name: bankName || null,
        notes: notes || null,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Payment recording failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods: { key: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
    { key: 'cash', label: 'Cash', icon: <Banknote size={16} /> },
    { key: 'upi', label: 'UPI / Scan', icon: <Smartphone size={16} /> },
    { key: 'card', label: 'Card Swipe', icon: <CreditCard size={16} /> },
    { key: 'bank_transfer', label: 'Bank IMPS', icon: <DollarSign size={16} /> },
    { key: 'cheque', label: 'Cheque', icon: <ClipboardListIcon size={16} /> },
  ];

  function ClipboardListIcon({ size }: { size: number }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <path d="M12 11h4"></path>
        <path d="M12 16h4"></path>
        <path d="M8 11h.01"></path>
        <path d="M8 16h.01"></path>
      </svg>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-xs text-text-secondary select-none">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Record Customer Payment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-app/40 rounded-full text-text-secondary hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Quick Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-[10px] text-text-secondary">Outstanding Balance</p>
              <p className="text-sm font-mono font-bold text-red-400 mt-0.5">
                {formatPaise(customer.outstanding_balance_paise)}
              </p>
            </div>
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3">
              <p className="text-[10px] text-text-secondary">Advance Balance</p>
              <p className="text-sm font-mono font-bold text-brand-500 mt-0.5">
                {formatPaise(customer.advance_balance_paise)}
              </p>
            </div>
          </div>

          {/* Amount field */}
          <div>
            <label className="block text-text-secondary mb-1">Payment Amount (₹) *</label>
            <div className="relative">
              <input
                type="number"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full bg-surface-app border border-border-subtle rounded-lg pl-8 pr-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
                autoFocus
              />
              <span className="absolute left-3 top-3 text-white font-mono">₹</span>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-2 mt-2">
              {[500, 1000, 2000, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handlePreset(val)}
                  className="flex-1 bg-surface-app border border-border-subtle hover:border-white hover:text-white rounded-md py-1 text-[10px] font-mono transition-colors"
                >
                  ₹{val}
                </button>
              ))}
              {outstandingRupees > 0 && (
                <button
                  type="button"
                  onClick={() => handlePreset(outstandingRupees)}
                  className="flex-1 bg-accent/20 border border-accent text-accent rounded-md py-1 text-[10px] font-bold transition-colors"
                >
                  Full Amount
                </button>
              )}
            </div>
          </div>

          {/* Method tabs */}
          <div>
            <label className="block text-text-secondary mb-1.5">Payment Method</label>
            <div className="grid grid-cols-5 gap-1 bg-surface-app p-1 rounded-lg">
              {methods.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center justify-center py-2 gap-1 rounded-md text-[9px] font-semibold transition-all border ${
                    method === m.key
                      ? 'bg-surface-panel border-border-subtle text-accent shadow-md'
                      : 'border-transparent text-text-secondary hover:text-white'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Details Fields */}
          {method !== 'cash' && method !== 'cheque' && (
            <div>
              <label className="block text-text-secondary mb-1">Reference Number</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent"
                placeholder="UPI txn hash or card approval ID"
              />
            </div>
          )}

          {method === 'cheque' && (
            <div className="grid grid-cols-2 gap-3 bg-surface-app/30 border border-border-subtle p-3 rounded-lg">
              <div>
                <label className="block text-[10px] text-text-secondary mb-0.5">Cheque Number</label>
                <input
                  type="text"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded px-2 py-1 text-white"
                  placeholder="e.g. 123456"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-0.5">Cheque Date</label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded px-2 py-1 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-text-secondary mb-0.5">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded px-2 py-1 text-white"
                  placeholder="e.g. State Bank of India"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-text-secondary mb-1">Remarks / Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white h-16 focus:outline-none focus:border-accent"
              placeholder="Cheque details, clearing date comments..."
            />
          </div>

          {/* Excess warning info box */}
          {excessPaise > 0 && (
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-3 text-brand-500 text-[10px]">
              <strong>Note:</strong> Overpayment of <strong>{formatPaise(excessPaise)}</strong> will be credited to this customer's Advance Deposit balance and auto-applied on future credit sales invoices.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-subtle hover:border-white rounded-lg text-white font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-accent hover:bg-brand-500 rounded-lg text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check size={14} />
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
