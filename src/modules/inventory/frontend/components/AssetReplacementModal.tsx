import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useRecordAssetReplacement, AssetItem } from '../hooks/useAssets';

interface AssetReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetItem | null;
}

export default function AssetReplacementModal({ isOpen, onClose, asset }: AssetReplacementModalProps) {
  const recordReplacement = useRecordAssetReplacement();

  const [replacementDate, setReplacementDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [costRupees, setCostRupees] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!reason.trim()) {
      setError('Please provide a reason for the replacement.');
      return;
    }

    const costNum = costRupees ? parseFloat(costRupees) : 0;

    try {
      await recordReplacement.mutateAsync({
        asset_id: asset.id,
        replacement_date: replacementDate,
        reason: reason.trim(),
        replacement_cost_paise: Math.round(costNum * 100),
        notes: notes.trim() || undefined,
      });

      setSuccess(`Replacement logged for ${asset.name}! Status updated.`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to record asset replacement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
              <RefreshCw size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Record Asset Replacement</h2>
              <p className="text-xs text-text-muted">Log replacement event and update maintenance history.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Asset Info Strip */}
        <div className="p-3.5 bg-surface-app border-b border-border-subtle text-xs flex items-center justify-between">
          <div>
            <span className="font-semibold text-text-primary">{asset.name}</span>
            <span className="text-text-muted ml-2">({asset.category})</span>
          </div>
          <div className="font-mono text-text-muted">
            Prior Replacements: <strong className="text-text-primary">{asset.times_replaced}</strong>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Replacement Date *</label>
            <input
              type="date"
              required
              value={replacementDate}
              onChange={e => setReplacementDate(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Reason for Replacement *</label>
            <input
              type="text"
              required
              placeholder="e.g. Compressor burnout, sensor failure, routine upgrade"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Replacement / Repair Cost (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00 (Leave blank if under warranty)"
              value={costRupees}
              onChange={e => setCostRupees(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Notes / Vendor Details</label>
            <textarea
              rows={2}
              placeholder="Invoice reference, technician contact, new warranty..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
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
              disabled={recordReplacement.isPending}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              {recordReplacement.isPending ? 'Logging...' : 'Confirm Replacement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
