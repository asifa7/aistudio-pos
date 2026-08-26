import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Wallet, 
  Landmark, 
  QrCode, 
  CreditCard,
  Sparkles
} from 'lucide-react';
import { OutstandingPurchaseBill, useRecordPaymentReceipt, useLiquidBalances } from '../hooks/usePaymentEngine';

interface BillPaymentModalProps {
  supplierId: number;
  supplierName: string;
  selectedBills: OutstandingPurchaseBill[];
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (voucher: any) => void;
}

export default function BillPaymentModal({
  supplierId,
  supplierName,
  selectedBills,
  isOpen,
  onClose,
  onPaymentComplete
}: BillPaymentModalProps) {
  // Step 1 = Entry & Allocation, Step 2 = Double-Verification Review
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'upi' | 'card'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [totalAmountRupees, setTotalAmountRupees] = useState<string>('');
  const [narration, setNarration] = useState<string>('');

  // Allocations mapping: bill_id -> allocated_rupees
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { data: balances } = useLiquidBalances();
  const recordMutation = useRecordPaymentReceipt();

  // Compute total outstanding across selected bills
  const totalOutstandingPaise = useMemo(() => {
    return selectedBills.reduce((sum, b) => sum + (b.outstanding_balance_paise || 0), 0);
  }, [selectedBills]);

  const totalOutstandingRupees = (totalOutstandingPaise / 100).toFixed(2);

  // Initialize on open
  useEffect(() => {
    if (isOpen && selectedBills.length > 0) {
      setStep(1);
      setErrorMsg(null);
      setIsSubmitting(false);
      setNarration('');

      // Default total amount to total outstanding
      setTotalAmountRupees(totalOutstandingRupees);

      // Default allocations
      const initialAllocs: Record<number, string> = {};
      selectedBills.forEach(b => {
        initialAllocs[b.id] = (b.outstanding_balance_paise / 100).toFixed(2);
      });
      setAllocations(initialAllocs);
    }
  }, [isOpen, selectedBills, totalOutstandingRupees]);

  if (!isOpen || selectedBills.length === 0) return null;

  // Live calculations
  const parsedTotalAmount = parseFloat(totalAmountRupees) || 0;

  const totalAllocatedRupees = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const num = parseFloat(val) || 0;
      return sum + num;
    }, 0);
  }, [allocations]);

  const remainingUnallocatedRupees = Math.max(0, parsedTotalAmount - totalAllocatedRupees);

  // Auto-allocate entered total across bills in FIFO order
  const handleAutoAllocate = (amountToDistribute: number) => {
    let rem = amountToDistribute;
    const newAllocs: Record<number, string> = {};

    for (const b of selectedBills) {
      const bOutstandingRupees = b.outstanding_balance_paise / 100;
      if (rem <= 0) {
        newAllocs[b.id] = '0.00';
      } else {
        const alloc = Math.min(rem, bOutstandingRupees);
        newAllocs[b.id] = alloc.toFixed(2);
        rem -= alloc;
      }
    }
    setAllocations(newAllocs);
  };

  const handleTotalAmountChange = (val: string) => {
    setTotalAmountRupees(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedBills.length === 1) {
        setAllocations({ [selectedBills[0].id]: val });
      } else {
        handleAutoAllocate(num);
      }
    } else {
      setAllocations({});
    }
  };

  const handleBillAllocationChange = (billId: number, val: string) => {
    const bill = selectedBills.find(b => b.id === billId);
    if (!bill) return;

    const numVal = parseFloat(val) || 0;
    const maxRupees = bill.outstanding_balance_paise / 100;

    if (numVal > maxRupees) {
      setErrorMsg(`Amount for bill #${bill.supplier_invoice_number || bill.invoice_number} cannot exceed ₹${maxRupees.toFixed(2)}.`);
    } else {
      setErrorMsg(null);
    }

    setAllocations(prev => ({
      ...prev,
      [billId]: val,
    }));
  };

  // Step 1 Validation -> Move to Step 2
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedTotalAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (totalAllocatedRupees <= 0) {
      setErrorMsg('Please allocate payment amount to at least one bill.');
      return;
    }

    if (totalAllocatedRupees > parsedTotalAmount) {
      setErrorMsg(`Allocated sum (₹${totalAllocatedRupees.toFixed(2)}) cannot exceed total payment amount (₹${parsedTotalAmount.toFixed(2)}).`);
      return;
    }

    // Hard validation against every bill's outstanding balance
    for (const b of selectedBills) {
      const allocated = parseFloat(allocations[b.id] || '0') || 0;
      const maxAllowed = b.outstanding_balance_paise / 100;

      if (allocated > maxAllowed + 0.001) {
        setErrorMsg(
          `Payment amount ₹${allocated.toFixed(2)} exceeds current outstanding balance ₹${maxAllowed.toFixed(2)} for bill #${b.supplier_invoice_number || b.invoice_number}.`
        );
        return;
      }
    }

    // Move to double-verification review step
    setStep(2);
  };

  // Step 2 Final Confirmation & Submit
  const handleFinalConfirm = async () => {
    if (isSubmitting) return; // Prevent double submit
    setIsSubmitting(true);
    setErrorMsg(null);

    // Build allocation payload
    const allocationPayload = selectedBills
      .filter(b => (parseFloat(allocations[b.id] || '0') || 0) > 0)
      .map(b => ({
        bill_type: 'purchase_invoice' as const,
        bill_id: b.id,
        bill_number: b.supplier_invoice_number || b.purchase_ref_number || b.invoice_number,
        allocated_amount_paise: Math.round((parseFloat(allocations[b.id] || '0') || 0) * 100),
      }));

    // Client-side unique idempotency key
    const idempotencyKey = `PAY-${supplierId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await recordMutation.mutateAsync({
        direction: 'payment',
        payment_method: paymentMethod,
        party_type: 'supplier',
        party_id: supplierId,
        party_name: supplierName,
        amount_paise: Math.round(parsedTotalAmount * 100),
        payment_date: paymentDate,
        narration: narration.trim() || undefined,
        idempotency_key: idempotencyKey,
        allocations: allocationPayload,
      });

      onPaymentComplete(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment');
      setIsSubmitting(false);
    }
  };

  const cashInHandRupees = ((balances?.cashInHandPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const bankBalanceRupees = ((balances?.bankBalancePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <DollarSign size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary flex items-center gap-2">
                <span>Record Purchase Bill Payment</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold">
                  Step {step} of 2: {step === 1 ? 'Enter Details' : 'Double-Verification'}
                </span>
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Pay supplier liabilities with bill-wise allocation and double confirmation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* STEP 1: Details & Bill Allocation */}
        {step === 1 && (
          <form onSubmit={handleProceedToReview} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Supplier & Balance Strip */}
            <div className="p-3.5 bg-surface-panel rounded-xl border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase">Supplier</span>
                <div className="font-bold text-text-primary flex items-center gap-1.5 mt-0.5">
                  <Building2 size={13} className="text-brand-500" />
                  <span>{supplierName}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase">Selected Bills Total</span>
                <div className="font-mono font-black text-rose-400 text-sm mt-0.5">
                  ₹{Number(totalOutstandingRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-text-muted uppercase">Available Balance</span>
                <div className="text-[11px] font-mono text-text-secondary mt-0.5">
                  Cash: <strong className="text-amber-400">₹{cashInHandRupees}</strong> | Bank: <strong className="text-cyan-400">₹{bankBalanceRupees}</strong>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">
                Payment Mode *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Wallet, color: 'text-amber-400' },
                  { id: 'bank', label: 'Bank Transfer', icon: Landmark, color: 'text-cyan-400' },
                  { id: 'upi', label: 'UPI / QR', icon: QrCode, color: 'text-emerald-400' },
                  { id: 'card', label: 'Card / Cheque', icon: CreditCard, color: 'text-purple-400' },
                ].map(m => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-brand-500/10 border-brand-500 text-text-primary shadow-sm'
                          : 'bg-surface-panel border-border-subtle text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Icon size={16} className={m.color} />
                      <span className="text-xs font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount & Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Total Payment Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-text-muted">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(totalOutstandingRupees)}
                    value={totalAmountRupees}
                    onChange={e => handleTotalAmountChange(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
                <div className="text-[10.5px] text-text-muted mt-1">
                  Defaults to full balance (₹{Number(totalOutstandingRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Edit down for partial payment.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Bill Allocation Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-text-secondary">
                <span>Allocate Across Selected Bills ({selectedBills.length})</span>
                {selectedBills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleAutoAllocate(parsedTotalAmount)}
                    className="text-brand-400 hover:text-brand-300 text-[11px] flex items-center gap-1 font-semibold"
                  >
                    <Sparkles size={12} /> Auto-Distribute FIFO
                  </button>
                )}
              </div>

              <div className="border border-border-subtle rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
                      <th className="py-2.5 px-3">Bill / Invoice #</th>
                      <th className="py-2.5 px-3">Bill Date</th>
                      <th className="py-2.5 px-3 text-right">Outstanding</th>
                      <th className="py-2.5 pr-3 text-right w-36">Pay Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-medium">
                    {selectedBills.map(b => {
                      const outRupees = (b.outstanding_balance_paise / 100).toFixed(2);
                      const currentAlloc = allocations[b.id] ?? '';

                      return (
                        <tr key={b.id} className="hover:bg-surface-hover/50">
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-text-primary">
                              {b.supplier_invoice_number || b.purchase_ref_number || b.invoice_number}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-text-secondary text-[11px]">{b.invoice_date}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 font-bold">
                            ₹{Number(outRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Number(outRupees)}
                              value={currentAlloc}
                              onChange={e => handleBillAllocationChange(b.id, e.target.value)}
                              className="w-full bg-surface-card border border-border-subtle rounded-lg px-2 py-1 text-right font-mono font-bold text-xs text-text-primary outline-none focus:border-brand-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Allocation Balance Footer */}
              <div className="p-2.5 bg-surface-panel rounded-xl border border-border-subtle flex items-center justify-between text-xs font-mono">
                <span className="text-text-muted">Total Entered: <strong>₹{parsedTotalAmount.toFixed(2)}</strong></span>
                <span className="text-emerald-400 font-bold">Allocated: ₹{totalAllocatedRupees.toFixed(2)}</span>
                <span className={remainingUnallocatedRupees > 0 ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  Unallocated: ₹{remainingUnallocatedRupees.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Narration */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                Narration / Reference Notes (Optional)
              </label>
              <input
                type="text"
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="e.g. Paid via IMPS Ref #492819 / Cheque #0029"
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-brand-500/20 flex items-center gap-1.5"
              >
                <span>Review Payment</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Double-Verification Confirmation Summary */}
        {step === 2 && (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Verification Alert Banner */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5">
              <ShieldCheck size={20} className="shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-emerald-400">Double-Verification Review</div>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed mt-0.5">
                  Please review the exact amounts and resulting balances below. No database record will be created until you explicitly click &ldquo;Confirm &amp; Post Payment&rdquo;.
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold text-text-muted uppercase">Supplier</span>
                <div className="font-bold text-text-primary mt-0.5 truncate">{supplierName}</div>
              </div>

              <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold text-text-muted uppercase">Payment Mode</span>
                <div className="font-bold text-text-primary uppercase mt-0.5">{paymentMethod}</div>
              </div>

              <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                <span className="text-[10px] font-bold text-text-muted uppercase">Total Payment Amount</span>
                <div className="font-mono font-black text-brand-400 text-sm mt-0.5">
                  ₹{parsedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Post-Payment Balances Breakdown */}
            <div className="border border-border-subtle rounded-xl overflow-hidden">
              <div className="p-2.5 bg-surface-panel border-b border-border-subtle text-[11px] font-bold text-text-secondary">
                Bill Balances After This Payment
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-app border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
                    <th className="py-2.5 px-3">Bill / Invoice #</th>
                    <th className="py-2.5 px-3 text-right">Current Balance</th>
                    <th className="py-2.5 px-3 text-right">Paying Now</th>
                    <th className="py-2.5 pr-3 text-right">New Balance After Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-medium">
                  {selectedBills.map(b => {
                    const currentOutPaise = b.outstanding_balance_paise;
                    const payingPaise = Math.round((parseFloat(allocations[b.id] || '0') || 0) * 100);
                    const newOutPaise = Math.max(0, currentOutPaise - payingPaise);

                    const isFullyPaid = newOutPaise === 0;

                    return (
                      <tr key={b.id} className="hover:bg-surface-hover/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-text-primary">
                          {b.supplier_invoice_number || b.purchase_ref_number || b.invoice_number}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-text-muted">
                          ₹{(currentOutPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-400">
                          ₹{(payingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono font-bold">
                          {isFullyPaid ? (
                            <span className="text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 size={12} /> ₹0.00 (Fully Paid)
                            </span>
                          ) : (
                            <span className="text-amber-400">
                              ₹{(newOutPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Partial)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {narration && (
              <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle text-xs text-text-secondary">
                <span className="text-text-muted font-bold">Narration: </span>{narration}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
              >
                ← Back to Edit
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                >
                  <CheckCircle2 size={15} className={isSubmitting ? 'animate-spin' : ''} />
                  <span>{isSubmitting ? 'Posting Transaction...' : 'Confirm & Post Payment'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
