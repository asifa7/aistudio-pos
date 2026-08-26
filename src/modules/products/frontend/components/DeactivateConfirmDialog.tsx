import { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, PowerOff } from 'lucide-react';
import type { AdminProduct, AdminProductVariant } from '../../types/products.types';

interface DeactivateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  target: { type: 'product'; item: AdminProduct } | { type: 'variant'; item: AdminProductVariant } | null;
  onDeactivate: () => Promise<void>;
  onHardDelete: () => Promise<void>;
}

export default function DeactivateConfirmDialog({
  isOpen, onClose, target, onDeactivate, onHardDelete,
}: DeactivateConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  if (!isOpen || !target) return null;

  const hasHistory = target.item.hasInvoiceHistory;
  const label = target.type === 'product'
    ? `product "${(target.item as AdminProduct).name}"`
    : `variant "${(target.item as AdminProductVariant).variant_name}"`;
  const cascadeNote = target.type === 'product'
    ? 'All variants under this product will also be deactivated.'
    : null;

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onDeactivate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHardDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onHardDelete();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle size={18} className="text-rose-400" />
            </div>
            <h2 className="font-bold text-sm text-text-secondary">
              {hasHistory ? 'Deactivate' : 'Remove'} {target.type === 'product' ? 'Product' : 'Variant'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-secondary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {hasHistory ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                The {label} has <strong className="text-rose-400">invoice history</strong> and cannot be permanently deleted.
                You can deactivate it — it will no longer appear in billing but past invoices remain intact.
              </p>
              {cascadeNote && (
                <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 font-medium">
                  ⚠ {cascadeNote}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                The {label} has <strong className="text-brand-500">no invoice history</strong>.
                You can either deactivate (reversible) or permanently delete it.
              </p>
              {cascadeNote && (
                <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 font-medium">
                  ⚠ {cascadeNote}
                </div>
              )}
              <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-medium">
                ⚠ Permanent deletion cannot be undone.
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border-subtle flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-subtle text-xs font-semibold text-text-secondary hover:bg-surface-card transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleDeactivate}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            <PowerOff size={13} />
            Deactivate
          </button>

          {!hasHistory && (
            <button
              onClick={handleHardDelete}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete Permanently
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
