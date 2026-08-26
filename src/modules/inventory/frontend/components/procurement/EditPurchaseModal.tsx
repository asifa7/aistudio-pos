import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { useEditPurchaseRecord } from '../../hooks/useSupplierProcurement';

interface Props {
  invoiceId: number;
  currentBillNumber?: string;
  currentNotes?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPurchaseModal({
  invoiceId,
  currentBillNumber = '',
  currentNotes = '',
  onClose,
  onSuccess,
}: Props) {
  const [billNumber, setBillNumber] = useState(currentBillNumber);
  const [notes, setNotes] = useState(currentNotes);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const editMutation = useEditPurchaseRecord();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please enter a mandatory reason for this correction.');
      return;
    }

    try {
      await editMutation.mutateAsync({
        invoiceId,
        updateData: {
          supplier_invoice_number: billNumber,
          notes,
        },
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to edit purchase record');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-text-primary">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="text-base font-bold font-outfit flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} />
            Edit Purchase Record (ID: #{invoiceId})
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-text-muted">
          Edits are restricted to Admin/Manager within 24 hours of entry. All changes are logged in the audit trail.
        </p>

        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/60 text-red-300 p-2.5 rounded text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-text-secondary mb-1 font-bold">Supplier Bill Number</label>
            <input
              type="text"
              value={billNumber}
              onChange={e => setBillNumber(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
              placeholder="e.g. INV-1002"
            />
          </div>

          <div>
            <label className="block text-text-secondary mb-1 font-bold font-mono">Notes / Reminders</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
              placeholder="Add audit notes..."
            />
          </div>

          <div>
            <label className="block text-amber-400 mb-1 font-bold uppercase tracking-wider text-[10px]">
              Reason for Edit (Mandatory Audit Trail) *
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              className="w-full bg-surface-card border border-amber-500/50 rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-amber-500"
              placeholder="e.g. Corrected handwritten bill number typo"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-surface-card hover:bg-surface-app border border-border-subtle rounded-lg text-text-secondary font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editMutation.isPending}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={14} />
              {editMutation.isPending ? 'Saving...' : 'Save Audit Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
