import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, IndianRupee } from 'lucide-react';
import { useRecordSupplierPayment } from '../../hooks/useSupplierProcurement';
import { formatPaise } from '../../types/supplier.types';
import { SupplierPaymentSchema } from '../../validation/supplier_procurement.schema';

interface SupplierPaymentDialogProps {
  supplierId: number;
  supplierName: string;
  outstandingBalancePaise: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SupplierPaymentDialog({
  supplierId,
  supplierName,
  outstandingBalancePaise,
  onClose,
  onSuccess,
}: SupplierPaymentDialogProps) {
  const recordPaymentMutation = useRecordSupplierPayment();

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    cheque_number: '',
    cheque_date: '',
    bank_name: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    is_advance: false,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setErrorMsg('');

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormErrors({ amount: 'Payment amount must be greater than zero' });
      return;
    }

    const validationInput = {
      supplier_id: supplierId,
      amount_paise: Math.round(parseFloat(formData.amount) * 100),
      payment_method: formData.payment_method,
      reference_number: formData.reference_number.trim() || null,
      cheque_number: formData.cheque_number.trim() || null,
      cheque_date: formData.cheque_date || null,
      bank_name: formData.bank_name.trim() || null,
      payment_date: formData.payment_date,
      notes: formData.notes.trim() || null,
      is_advance: formData.is_advance ? 1 : 0,
    };

    // Parse with Zod schema
    const parsed = SupplierPaymentSchema.safeParse(validationInput);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err: any) => {
        if (err.path[0]) {
          errors[String(err.path[0])] = err.message;
        }
      });
      setFormErrors(errors);
      setErrorMsg('Please correct the highlighted errors.');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync(parsed.data);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record supplier payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel rounded-xl border border-border-subtle overflow-hidden w-full max-w-lg shadow-xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="border-b border-border-subtle p-4 flex items-center justify-between bg-surface-app/40">
          <div>
            <h3 className="text-sm font-bold font-outfit text-text-secondary">Record Supplier Payment</h3>
            <p className="text-[10px] text-text-muted">Supplier: <span className="text-accent font-semibold">{supplierName}</span></p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-lg text-xs font-semibold text-rose-400 flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current balance card */}
          <div className="bg-surface-app/50 border border-border-subtle rounded-lg p-3 flex justify-between items-center text-xs">
            <div>
              <p className="text-text-muted text-[10px] uppercase font-bold">Outstanding Balance</p>
              <p className="text-base font-bold font-mono text-text-secondary mt-0.5">
                {formatPaise(outstandingBalancePaise)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-text-muted text-[10px] uppercase font-bold">Auto Allocation</p>
              <p className="text-[10px] font-semibold text-accent mt-0.5">FIFO Across Unpaid Invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase font-bold text-text-muted">Payment Amount (₹) *</label>
              <div className="relative">
                <IndianRupee size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="number"
                  step="0.01"
                  required
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className={`w-full pl-9 pr-3 py-1.5 bg-surface-app border ${formErrors.amount ? 'border-rose-500' : 'border-border-subtle'} text-text-secondary rounded-lg text-xs font-semibold font-mono outline-none focus:border-accent`}
                />
              </div>
              {formErrors.amount && <p className="text-[10px] text-rose-400 font-semibold">{formErrors.amount}</p>}
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase font-bold text-text-muted">Payment Date *</label>
              <input
                type="date"
                required
                name="payment_date"
                value={formData.payment_date}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-mono outline-none focus:border-accent"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase font-bold text-text-muted">Payment Method *</label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-semibold outline-none focus:border-accent"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="upi">UPI / QR Scan</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash In Hand</option>
                <option value="card">Credit/Debit Card</option>
              </select>
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase font-bold text-text-muted">Txn Reference Number</label>
              <input
                type="text"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleInputChange}
                placeholder="e.g. UTR / UPI Transaction ID"
                className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
              />
            </div>
          </div>

          {/* Conditional Cheque Details */}
          {formData.payment_method === 'cheque' && (
            <div className="p-3 bg-surface-app/40 border border-border-subtle rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in slide-in-from-top duration-200">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Cheque No.</label>
                <input
                  type="text"
                  name="cheque_number"
                  value={formData.cheque_number}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 bg-surface-app border border-border-subtle text-text-secondary rounded text-xs font-semibold font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Cheque Date</label>
                <input
                  type="date"
                  name="cheque_date"
                  value={formData.cheque_date}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 bg-surface-app border border-border-subtle text-text-secondary rounded text-xs font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="e.g. SBI, HDFC"
                  className="w-full px-2 py-1 bg-surface-app border border-border-subtle text-text-secondary rounded text-xs font-semibold outline-none"
                />
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="flex items-center gap-2 pt-2 select-none">
            <input
              type="checkbox"
              id="is_advance"
              name="is_advance"
              checked={formData.is_advance}
              onChange={handleInputChange}
              className="rounded border-border-subtle bg-surface-app text-accent focus:ring-accent"
            />
            <label htmlFor="is_advance" className="text-[10px] uppercase font-bold text-text-secondary cursor-pointer">
              Mark as Advance Payment (Add to Supplier's Unallocated Pool)
            </label>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Payment Notes</label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="e.g. Paid against monthly inventory supply"
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-surface-app text-xs font-bold rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              <CheckCircle size={13} />
              {recordPaymentMutation.isPending ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
