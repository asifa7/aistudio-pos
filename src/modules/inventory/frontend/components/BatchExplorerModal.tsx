import { useState } from 'react';
import { X, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface BatchExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  productVariantId: number | null;
  productName?: string;
}

export default function BatchExplorerModal({ isOpen, onClose, productVariantId, productName }: BatchExplorerModalProps) {
  const queryClient = useQueryClient();
  const [correctingBatchId, setCorrectingBatchId] = useState<number | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionMsg, setCorrectionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: batches, isLoading, refetch } = useQuery({
    queryKey: ['stock-batches', productVariantId],
    queryFn: async () => {
      if (!productVariantId) return [];
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_BATCHES, { product_variant_id: productVariantId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!productVariantId && isOpen,
  });

  const correctMutation = useMutation({
    mutationFn: async (args: { batch_id: number; reason: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CORRECT_BATCH, args);
      if (!res.success) throw new Error(res.error?.message || 'Correction failed');
      return res.data;
    },
    onSuccess: (data: any) => {
      setCorrectionMsg({ type: 'success', text: data?.message || 'Batch corrected successfully.' });
      setCorrectingBatchId(null);
      setCorrectionReason('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['stock-status'] });
    },
    onError: (err: any) => {
      setCorrectionMsg({ type: 'error', text: err.message || 'Failed to correct batch.' });
    },
  });

  if (!isOpen || !productVariantId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">FIFO Batch Explorer</h2>
              <p className="text-xs text-text-muted">Item: <strong className="text-text-primary">{productName || `Variant #${productVariantId}`}</strong> · Sequential FIFO drawdown tracking.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Batch Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin text-brand-500" size={16} /> Loading batch ledger...
            </div>
          ) : !batches || batches.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">No stock batches found for this product item.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Received Date</th>
                  <th className="py-2.5 px-3">Source Type</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Initial Qty</th>
                  <th className="py-2.5 px-3 text-right">Remaining Qty</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 font-mono">
                {batches.map((b: any) => {
                  const isWeight = b.initial_quantity_grams !== null;
                  const initQtyStr = isWeight ? `${((b.initial_quantity_grams || 0) / 1000).toFixed(3)} kg` : `${b.initial_quantity_units || 0} pcs`;
                  const currQtyStr = isWeight ? `${((b.current_quantity_grams || 0) / 1000).toFixed(3)} kg` : `${b.current_quantity_units || 0} pcs`;
                  const unitCost = ((b.unit_cost_paise || 0) / 100).toFixed(2);
                  const isActive = b.status === 'active';

                  return (
                    <tr key={b.id} className={`transition-colors ${isActive ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'opacity-60 hover:bg-surface-hover'}`}>
                      <td className="py-2.5 px-3 font-bold text-text-primary">{b.batch_number}</td>
                      <td className="py-2.5 px-3 text-text-muted text-[11px]">{new Date(b.received_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 capitalize font-sans text-brand-500 font-semibold">{b.source_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-text-primary">₹{unitCost}</td>
                      <td className="py-2.5 px-3 text-right text-text-muted">{initQtyStr}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-text-primary">{currQtyStr}</td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-card text-text-muted border border-border-subtle">
                            EXHAUSTED
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {isActive && (
                          correctingBatchId === b.id ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <input
                                type="text"
                                value={correctionReason}
                                onChange={e => setCorrectionReason(e.target.value)}
                                placeholder="Reason for correction..."
                                className="w-44 px-2 py-1 bg-surface-app border border-rose-500/40 rounded text-[11px] text-text-primary outline-none focus:border-rose-500 font-sans"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => correctMutation.mutate({ batch_id: b.id, reason: correctionReason })}
                                  disabled={correctionReason.trim().length < 3 || correctMutation.isPending}
                                  className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded hover:bg-rose-600 disabled:opacity-40 transition-colors"
                                >
                                  {correctMutation.isPending ? '...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => { setCorrectingBatchId(null); setCorrectionReason(''); }}
                                  className="px-2 py-0.5 text-[10px] font-bold bg-surface-card text-text-muted border border-border-subtle rounded hover:bg-surface-hover transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setCorrectingBatchId(b.id); setCorrectionMsg(null); }}
                              className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/20 transition-colors"
                              title="Correct/reverse this batch stock"
                            >
                              <AlertTriangle size={10} className="inline mr-0.5" /> Correct
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {correctionMsg && (
          <div className={`mx-4 mb-2 p-2.5 rounded-lg text-xs font-semibold ${
            correctionMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}>
            {correctionMsg.text}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-app flex items-center justify-between shrink-0 rounded-b-2xl">
          <div className="text-xs text-text-muted">FIFO order: Oldest active batch is drawn down first during sales & yield processing.</div>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
