import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface TransferReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: any;
}

export default function TransferReceiptModal({
  isOpen,
  onClose,
  transfer,
}: TransferReceiptModalProps) {
  const queryClient = useQueryClient();

  const [receivedMap, setReceivedMap] = useState<Record<number, string>>({});
  const [discrepancyNotes, setDiscrepancyNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transfer && transfer.items) {
      const initialMap: Record<number, string> = {};
      transfer.items.forEach((item: any) => {
        const isWeight = item.sent_quantity_grams !== null;
        const val = isWeight ? ((item.sent_quantity_grams ?? 0) / 1000).toString() : (item.sent_quantity_units ?? 0).toString();
        initialMap[item.id] = val;
      });
      setReceivedMap(initialMap);
    }
  }, [isOpen, transfer]);

  const confirmMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CONFIRM_TRANSFER_RECEIPT, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (!isOpen || !transfer) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const itemsPayload: any[] = [];
    let hasDiscrepancy = false;

    for (const item of transfer.items) {
      const valStr = receivedMap[item.id];
      const val = parseFloat(valStr);
      if (isNaN(val) || val < 0) {
        setErrorMsg(`Please enter a valid received quantity for ${item.product_name}`);
        return;
      }

      const isWeight = item.sent_quantity_grams !== null;
      const sentQty = isWeight ? (item.sent_quantity_grams ?? 0) / 1000 : (item.sent_quantity_units ?? 0);

      if (val < sentQty) {
        hasDiscrepancy = true;
      }

      itemsPayload.push({
        item_id: item.id,
        received_quantity_grams: isWeight ? Math.round(val * 1000) : null,
        received_quantity_units: !isWeight ? Math.round(val) : null,
      });
    }

    try {
      await confirmMutation.mutateAsync({
        transfer_id: transfer.id,
        items: itemsPayload,
        discrepancy_notes: hasDiscrepancy ? (discrepancyNotes.trim() || 'Shortfall noted on receipt') : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-status'] });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm receipt');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Confirm Transfer Receipt ({transfer.transfer_number})</h2>
              <p className="text-xs text-text-muted">From: <strong className="text-text-primary">{transfer.from_location_name}</strong> → To: <strong className="text-text-primary">{transfer.to_location_name}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <div className="text-xs text-text-muted">
            Verify actual physically received quantities below. Any shortfall will automatically be logged as a <strong className="text-rose-400">Loss-in-Transit Wastage Adjustment</strong>.
          </div>

          {/* Items Receipt List */}
          <div className="space-y-2 border border-border-subtle rounded-xl p-3 bg-surface-app">
            {transfer.items.map((item: any) => {
              const isWeight = item.sent_quantity_grams !== null;
              const sentQty = isWeight ? (item.sent_quantity_grams ?? 0) / 1000 : item.sent_quantity_units ?? 0;
              const recValStr = receivedMap[item.id] ?? sentQty.toString();
              const recVal = parseFloat(recValStr) || 0;
              const shortfall = Math.max(0, sentQty - recVal);

              return (
                <div key={item.id} className="p-3 bg-surface-panel border border-border-subtle rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-text-primary">{item.product_name} - {item.variant_name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 font-mono">
                      Sent: <strong className="text-text-primary">{sentQty.toFixed(3)} {isWeight ? 'kg' : 'pcs'}</strong> · Cost: ₹{(item.unit_cost_paise/100).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <label className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Received Qty</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max={sentQty}
                        value={recValStr}
                        onChange={e => setReceivedMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs text-emerald-400 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {shortfall > 0 && (
                      <div className="text-right">
                        <div className="text-[9px] uppercase font-bold text-rose-400">Shortfall</div>
                        <div className="text-xs font-mono font-extrabold text-rose-400">-{shortfall.toFixed(3)} {isWeight ? 'kg' : 'pcs'}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discrepancy Remarks */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-muted uppercase">Discrepancy Notes / Reason (If Shortfall Noted)</label>
            <input
              type="text"
              value={discrepancyNotes}
              onChange={e => setDiscrepancyNotes(e.target.value)}
              placeholder="e.g. Sent 10kg, received 9.5kg due to bag leakage during transport..."
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-emerald-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold flex items-center gap-2">
              <AlertTriangle size={15} /> {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover">
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmMutation.isPending}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {confirmMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              Confirm Receipt & Activate Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
