import React, { useState, useEffect } from 'react';
import { X, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { ManualBatchAllocation } from '../types/billing.types';

interface ManualBatchPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  productVariantId: number | null;
  productName: string;
  unitType: 'weight' | 'piece' | 'live_dual';
  requiredQuantityGrams: number | null;
  requiredQuantityUnits: number | null;
  existingAllocations?: ManualBatchAllocation[];
  onSaveAllocations: (allocations: ManualBatchAllocation[]) => void;
}

export default function ManualBatchPickerModal({
  isOpen,
  onClose,
  productVariantId,
  productName,
  unitType,
  requiredQuantityGrams,
  requiredQuantityUnits,
  existingAllocations,
  onSaveAllocations,
}: ManualBatchPickerModalProps) {
  const isWeight = unitType === 'weight';
  const targetTotal = isWeight ? (requiredQuantityGrams ?? 0) / 1000 : requiredQuantityUnits ?? 0;

  // Map of batch_id -> entered quantity string
  const [allocInputs, setAllocInputs] = useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['active-batches-picker', productVariantId],
    queryFn: async () => {
      if (!productVariantId) return [];
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_BATCHES, { product_variant_id: productVariantId });
      if (!res.success) throw new Error(res.error.message);
      // Filter active batches
      return (res.data || []).filter((b: any) => b.status === 'active');
    },
    enabled: !!productVariantId && isOpen,
  });

  // Pre-fill existing allocations when modal opens
  useEffect(() => {
    if (isOpen && existingAllocations && existingAllocations.length > 0) {
      const initialMap: Record<number, string> = {};
      existingAllocations.forEach(alloc => {
        const val = isWeight ? ((alloc.quantity_grams ?? 0) / 1000).toString() : (alloc.quantity_units ?? 0).toString();
        initialMap[alloc.batch_id] = val;
      });
      setAllocInputs(initialMap);
    } else {
      setAllocInputs({});
    }
    setErrorMsg(null);
  }, [isOpen, existingAllocations, isWeight]);

  if (!isOpen || !productVariantId) return null;

  // Calculate current sum of allocated quantities
  let totalAllocated = 0;
  Object.values(allocInputs).forEach(val => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      totalAllocated += num;
    }
  });

  const diff = Math.abs(totalAllocated - targetTotal);
  const isExactMatch = diff < 0.0001;

  const handleQtyChange = (batchId: number, val: string) => {
    setAllocInputs(prev => ({ ...prev, [batchId]: val }));
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isExactMatch) {
      setErrorMsg(`Allocated quantity (${totalAllocated.toFixed(3)} ${isWeight ? 'kg' : 'pcs'}) must exactly match required quantity (${targetTotal.toFixed(3)} ${isWeight ? 'kg' : 'pcs'})`);
      return;
    }

    const payload: ManualBatchAllocation[] = [];
    (batches || []).forEach((b: any) => {
      const valStr = allocInputs[b.id];
      const val = parseFloat(valStr);
      if (!isNaN(val) && val > 0) {
        payload.push({
          batch_id: b.id,
          batch_number: b.batch_number,
          quantity_grams: isWeight ? Math.round(val * 1000) : null,
          quantity_units: !isWeight ? Math.round(val) : null,
          unit_cost_paise: b.unit_cost_paise,
        });
      }
    });

    if (payload.length === 0) {
      setErrorMsg('Please allocate quantity from at least one batch');
      return;
    }

    onSaveAllocations(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Manual Batch Selection</h2>
              <p className="text-xs text-text-muted">Item: <strong className="text-text-primary">{productName}</strong> · Target Order Qty: <span className="font-mono font-bold text-brand-500">{targetTotal.toFixed(3)} {isWeight ? 'kg' : 'pcs'}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Live Allocation Summary Strip */}
        <div className={`px-5 py-3 border-b flex items-center justify-between text-xs font-bold transition-all ${
          isExactMatch ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <div className="flex items-center gap-1.5">
            {isExactMatch ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>
              Allocated: <span className="font-mono font-black text-sm">{totalAllocated.toFixed(3)}</span> / <span className="font-mono font-black text-sm">{targetTotal.toFixed(3)} {isWeight ? 'kg' : 'pcs'}</span>
            </span>
          </div>
          <div>
            {isExactMatch ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px]">Ready to Attach</span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px]">
                {totalAllocated < targetTotal ? `Need ${(targetTotal - totalAllocated).toFixed(3)} more` : `Over by ${(totalAllocated - targetTotal).toFixed(3)}`}
              </span>
            )}
          </div>
        </div>

        {/* Batches Selection Form */}
        <form onSubmit={handleConfirm} className="p-5 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin text-brand-500" size={16} /> Loading active batches...
            </div>
          ) : !batches || batches.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">No active stock batches found for this product.</div>
          ) : (
            <div className="space-y-2">
              {batches.map((b: any) => {
                const availableQty = isWeight ? (b.current_quantity_grams ?? 0) / 1000 : b.current_quantity_units ?? 0;
                const unitCost = ((b.unit_cost_paise || 0) / 100).toFixed(2);
                const enteredVal = allocInputs[b.id] || '';

                return (
                  <div key={b.id} className="p-3 bg-surface-app border border-border-subtle rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-xs text-text-primary font-mono">{b.batch_number}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Received: {new Date(b.received_date).toLocaleDateString()} · Cost: <strong className="text-text-primary">₹{unitCost}/{isWeight ? 'kg' : 'pc'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-text-muted">Available</div>
                        <div className="text-xs font-mono font-extrabold text-brand-500">{availableQty.toFixed(3)} {isWeight ? 'kg' : 'pcs'}</div>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={availableQty}
                          placeholder="Draw Qty"
                          value={enteredVal}
                          onChange={e => handleQtyChange(b.id, e.target.value)}
                          className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs text-text-primary outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isExactMatch}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/20 disabled:opacity-40"
            >
              Attach Manual Batch Allocations
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
