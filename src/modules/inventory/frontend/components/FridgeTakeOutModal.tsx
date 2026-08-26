import React, { useState } from 'react';
import { X, LogOut, AlertCircle } from 'lucide-react';
import { RefrigeratorStockItem, useRecordFridgeRemoval } from '../hooks/useRefrigeratorStock';

interface FridgeTakeOutModalProps {
  item: RefrigeratorStockItem | null;
  onClose: () => void;
}

export default function FridgeTakeOutModal({ item, onClose }: FridgeTakeOutModalProps) {
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('Moved to Kitchen Prep');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const removeMutation = useRecordFridgeRemoval();

  if (!item) return null;

  const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual';
  const unitLabel = isWeight ? 'kg' : 'pcs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    if (qtyNum > item.quantity) {
      setError(`Cannot remove ${qtyNum} ${unitLabel}. Current stock in fridge is ${item.quantity.toFixed(2)} ${unitLabel}.`);
      return;
    }

    const finalReason = reason === 'Other' ? customReason.trim() || 'Manual Removal' : reason;

    try {
      await removeMutation.mutateAsync({
        batch_id: item.oldest_batch_id || item.batch_id || undefined,
        product_variant_id: item.product_variant_id,
        quantity: qtyNum,
        unit_type: item.unit_type,
        reason: finalReason,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove stock');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <LogOut size={18} />
            <span>Take Out from Refrigerator</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-surface-panel p-3 rounded-xl border border-border-subtle space-y-1 text-xs">
            <div className="text-sm font-bold text-text-primary">
              {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Code: <span className="font-mono text-text-secondary">{item.product_code || '-'}</span></span>
              <span>Available in Fridge: <strong className="text-emerald-400 font-mono">{item.quantity.toFixed(isWeight ? 3 : 0)} {unitLabel}</strong></span>
            </div>
            <div className="text-[11px] text-text-muted flex items-center justify-between">
              <span>Oldest Stock Age: <strong className="text-text-secondary">{item.days_in_fridge} day{item.days_in_fridge !== 1 ? 's' : ''}</strong></span>
              <span className="text-[10px] text-cyan-400">FIFO Deducts Oldest First</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
              Quantity to Remove ({unitLabel}) *
            </label>
            <div className="relative">
              <input
                type="number"
                step={isWeight ? '0.001' : '1'}
                min="0.001"
                max={item.quantity}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={`e.g. ${item.quantity.toFixed(1)}`}
                autoFocus
                required
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-text-primary outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => setQuantity(String(item.quantity))}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-card hover:bg-surface-hover text-text-secondary border border-border-subtle rounded text-[10px] font-bold"
              >
                All
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
              Reason / Purpose *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 mb-2"
            >
              <option value="Moved to Kitchen Prep">Moved to Kitchen Prep</option>
              <option value="Direct Counter Sale">Direct Counter Sale</option>
              <option value="Transferred to Processing">Transferred to Processing</option>
              <option value="Wastage / Spoilage">Wastage / Spoilage</option>
              <option value="Other">Other (Custom Reason)</option>
            </select>

            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Enter specific note..."
                required
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              />
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={removeMutation.isPending || !quantity}
              className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              {removeMutation.isPending ? 'Removing...' : 'Confirm Take Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
