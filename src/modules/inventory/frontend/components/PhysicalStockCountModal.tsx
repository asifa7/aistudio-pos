import React, { useState, useEffect } from 'react';
import { X, ClipboardCheck, AlertTriangle, CheckCircle2, Save, RefreshCw } from 'lucide-react';
import { useStockStatus, useSubmitPhysicalCount } from '../hooks/useInventory';

interface PhysicalStockCountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhysicalStockCountModal({ isOpen, onClose }: PhysicalStockCountModalProps) {
  const { data: stocks, isLoading } = useStockStatus();
  const submitCount = useSubmitPhysicalCount();

  const [counts, setCounts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && stocks) {
      setError(null);
      setSuccessMsg(null);
      const initialMap: Record<number, string> = {};
      stocks.forEach(item => {
        const isWeight = item.unit_type === 'weight';
        const currentQty = isWeight ? ((item.quantity_grams ?? 0) / 1000) : (item.quantity_units ?? 0);
        initialMap[item.product_variant_id] = `${currentQty}`;
      });
      setCounts(initialMap);
    }
  }, [isOpen, stocks]);

  if (!isOpen) return null;

  const handleInputChange = (variantId: number, val: string) => {
    setCounts(prev => ({ ...prev, [variantId]: val }));
  };

  const filteredStocks = (stocks || []).filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.product_name.toLowerCase().includes(term) ||
      item.variant_name.toLowerCase().includes(term) ||
      item.product_code.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  });

  // Mismatch calculations
  let mismatchCount = 0;
  const countPayload: Array<{ product_variant_id: number; counted_quantity: number }> = [];

  filteredStocks.forEach(item => {
    const isWeight = item.unit_type === 'weight';
    const currentQty = isWeight ? ((item.quantity_grams ?? 0) / 1000) : (item.quantity_units ?? 0);
    const valStr = counts[item.product_variant_id] ?? `${currentQty}`;
    const parsedVal = parseFloat(valStr);

    if (!isNaN(parsedVal)) {
      countPayload.push({
        product_variant_id: item.product_variant_id,
        counted_quantity: parsedVal,
      });

      if (Math.abs(parsedVal - currentQty) >= 0.001) {
        mismatchCount++;
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await submitCount.mutateAsync(countPayload);
      setSuccessMsg(`Physical count recorded successfully! Created ${res.adjustedCount} discrepancy correction adjustments.`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to record physical count');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Physical Stock Audit & Reconciliation</h2>
              <p className="text-xs text-text-muted">Enter actual physically counted quantities to automatically generate discrepancy corrections.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search & Summary Strip */}
        <div className="p-4 bg-surface-app border-b border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search product or category..."
            className="w-full sm:w-72 bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-brand-500"
          />

          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-muted font-medium">Total Items: <strong className="text-text-primary font-mono">{filteredStocks.length}</strong></span>
            <span className={`px-2.5 py-1 rounded-lg font-bold font-mono text-[11px] ${mismatchCount > 0 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
              {mismatchCount} Discrepanc{mismatchCount === 1 ? 'y' : 'ies'} Flagged
            </span>
          </div>
        </div>

        {/* Audit Form Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-text-muted flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin text-brand-500" size={18} /> Loading stock master...
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">System Stock</th>
                  <th className="py-2.5 px-3 text-right">Physically Counted</th>
                  <th className="py-2.5 px-3 text-right">Variance / Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredStocks.map(item => {
                  const isWeight = item.unit_type === 'weight';
                  const systemQty = isWeight ? ((item.quantity_grams ?? 0) / 1000) : (item.quantity_units ?? 0);
                  const unitLabel = isWeight ? 'kg' : 'pcs';

                  const userValStr = counts[item.product_variant_id] ?? `${systemQty}`;
                  const userVal = parseFloat(userValStr);
                  const diff = !isNaN(userVal) ? userVal - systemQty : 0;

                  const hasMismatch = Math.abs(diff) >= 0.001;

                  return (
                    <tr key={item.product_variant_id} className={`transition-colors ${hasMismatch ? 'bg-amber-500/5' : 'hover:bg-surface-hover'}`}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-text-primary">{item.product_name}</div>
                        <div className="text-[10px] text-text-muted">{item.variant_name} · <span className="font-mono">{item.product_code}</span></div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-card text-text-muted font-semibold text-[10px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-text-secondary">
                        {systemQty.toFixed(isWeight ? 3 : 0)} {unitLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <input
                            type="number"
                            step={isWeight ? '0.001' : '1'}
                            min="0"
                            value={userValStr}
                            onChange={e => handleInputChange(item.product_variant_id, e.target.value)}
                            className="w-28 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1 text-right font-mono font-bold text-text-primary outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                          <span className="text-text-muted text-[10px] w-6">{unitLabel}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {!hasMismatch ? (
                          <span className="text-emerald-400 text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle2 size={12} /> Match
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 ${diff > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                            <AlertTriangle size={11} />
                            {diff > 0 ? `+${diff.toFixed(isWeight ? 3 : 0)}` : diff.toFixed(isWeight ? 3 : 0)} {unitLabel}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-app flex items-center justify-between gap-4 shrink-0 rounded-b-2xl">
          {error && <div className="text-xs text-rose-400 font-semibold">{error}</div>}
          {successMsg && <div className="text-xs text-emerald-400 font-semibold">{successMsg}</div>}
          {!error && !successMsg && <div className="text-xs text-text-muted">Submitting will update stock quantities and log audit trail entries.</div>}

          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-semibold text-text-secondary hover:bg-surface-card transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitCount.isPending}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              <Save size={14} />
              {submitCount.isPending ? 'Saving Audit...' : `Submit Physical Count (${mismatchCount} Adjustments)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
