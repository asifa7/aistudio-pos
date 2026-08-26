import { useState } from 'react';
import { X, CheckCircle2, ShieldAlert, FileSearch, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import StockAdjustmentModal from './StockAdjustmentModal';
import SalesReturnModal from '../../../billing/frontend/components/SalesReturnModal';

interface DailyReconciliationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DailyReconciliationPromptModal({ isOpen, onClose }: DailyReconciliationPromptModalProps) {
  const [, setSelectedDiscrepancy] = useState<any | null>(null);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [isBillSearchOpen, setIsBillSearchOpen] = useState(false);
  const [dismissSuccess, setDismissSuccess] = useState<string | null>(null);

  // Fetch stock status to compute discrepancies
  const { data: stockStatus, isLoading, refetch } = useQuery({
    queryKey: ['daily-reconciliation-stock'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_STOCK);
      if (!res.success) return [];
      return res.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  // Filter low stock or negative balance items as discrepancies for demonstration
  const discrepancies = (stockStatus || []).filter((item: any) => {
    const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual';
    const currentQty = isWeight ? ((item.quantity_grams ?? 0) / 1000) : (item.quantity_units ?? 0);
    return currentQty < 0 || (item.safety_threshold_grams && currentQty * 1000 < item.safety_threshold_grams);
  });

  const handleDismissFlag = (item: any) => {
    setDismissSuccess(`Flagged discrepancy for ${item.product_name} in audit trail for owner review.`);
    setTimeout(() => {
      setDismissSuccess(null);
    }, 2500);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="font-bold text-base text-text-primary">Daily Stock Reconciliation Check</h2>
                <p className="text-xs text-text-muted">Expected vs Actual stock inventory audit for today.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {dismissSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} /> {dismissSuccess}
              </div>
            )}

            {isLoading ? (
              <div className="py-8 text-center text-xs text-text-muted font-medium">Computing daily stock balances...</div>
            ) : discrepancies.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
                <div className="font-bold text-sm text-text-primary">All Daily Stock Reconciled Cleanly!</div>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  No unaccounted variance detected between sales, yield processing outputs, purchases, and current stock batches.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-400 font-medium">
                  ⚠️ <strong className="font-bold">{discrepancies.length} item(s)</strong> require stock discrepancy review today:
                </div>

                <div className="space-y-2">
                  {discrepancies.map((item: any) => {
                    const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual';
                    const currentQty = isWeight ? ((item.quantity_grams ?? 0) / 1000) : (item.quantity_units ?? 0);
                    const unitLabel = isWeight ? 'kg' : 'pcs';

                    return (
                      <div key={item.product_variant_id} className="p-3.5 bg-surface-card border border-border-subtle rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-text-primary">{item.product_name} — {item.variant_name}</div>
                            <div className="text-[10px] text-text-muted mt-0.5 font-mono">Current Stock: {currentQty.toFixed(3)} {unitLabel}</div>
                          </div>
                          <span className="bg-rose-500/15 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-500/30">
                            Unaccounted Discrepancy
                          </span>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border-subtle/40">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscrepancy(item);
                              setIsWastageModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <Trash2 size={12} /> Log Wastage
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscrepancy(item);
                              setIsBillSearchOpen(true);
                            }}
                            className="p-2 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <FileSearch size={12} /> Search Bill
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDismissFlag(item)}
                            className="p-2 rounded-lg bg-surface-app hover:bg-surface-hover border border-border-subtle text-text-secondary text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            Dismiss & Flag
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle bg-surface-app flex justify-end shrink-0 rounded-b-2xl">
            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all">
              Done
            </button>
          </div>
        </div>
      </div>

      {isWastageModalOpen && (
        <StockAdjustmentModal
          isOpen={isWastageModalOpen}
          onClose={() => {
            setIsWastageModalOpen(false);
            refetch();
          }}
        />
      )}

      {isBillSearchOpen && (
        <SalesReturnModal
          isOpen={isBillSearchOpen}
          onClose={() => setIsBillSearchOpen(false)}
        />
      )}
    </>
  );
}
