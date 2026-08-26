import React, { useState, useEffect } from 'react';
import { X, Bird, CheckCircle2, AlertCircle, Plus, Minus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface LivestockLossModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type BirdCategory = 'chicken' | 'country_chicken' | 'quail';

interface BirdSizePreset {
  smallKg: number;
  mediumKg: number;
  largeKg: number;
}

const BIRD_WEIGHT_PRESETS: Record<BirdCategory, BirdSizePreset> = {
  chicken: { smallKg: 1.5, mediumKg: 2.0, largeKg: 2.5 },
  country_chicken: { smallKg: 1.2, mediumKg: 1.6, largeKg: 2.2 },
  quail: { smallKg: 0.15, mediumKg: 0.20, largeKg: 0.25 },
};

export default function LivestockLossModal({ isOpen, onClose }: LivestockLossModalProps) {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<BirdCategory>('chicken');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Bird count breakdown
  const [smallCount, setSmallCount] = useState<number>(0);
  const [mediumCount, setMediumCount] = useState<number>(0);
  const [largeCount, setLargeCount] = useState<number>(0);

  const [weightKg, setWeightKg] = useState<string>('0.000');
  const [isManualWeightOverride, setIsManualWeightOverride] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch product variants for selection
  const { data: stockStatus } = useQuery({
    queryKey: ['stock-status'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_STOCK, {});
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
    enabled: isOpen,
  });

  // Filter stock strictly to Chicken, Quails, and Country Chicken
  const livestockVariants = (stockStatus || []).filter((s: any) => {
    const name = `${s.product_name || ''} ${s.variant_name || ''}`.toLowerCase();
    return (
      name.includes('chicken') ||
      name.includes('broiler') ||
      name.includes('quail') ||
      name.includes('kaada') ||
      name.includes('country') ||
      name.includes('naatu') ||
      name.includes('nattu') ||
      name.includes('live')
    );
  });

  // Filter based on selected category
  const filteredByCategoryVariants = livestockVariants.filter((s: any) => {
    const name = `${s.product_name || ''} ${s.variant_name || ''}`.toLowerCase();
    if (selectedCategory === 'quail') {
      return name.includes('quail') || name.includes('kaada');
    }
    if (selectedCategory === 'country_chicken') {
      return name.includes('country') || name.includes('naatu') || name.includes('nattu');
    }
    // Default chicken (broiler)
    return !name.includes('country') && !name.includes('naatu') && !name.includes('nattu') && !name.includes('quail') && !name.includes('kaada');
  });

  // Auto-select first matching variant when category or list changes
  useEffect(() => {
    if (filteredByCategoryVariants.length > 0) {
      if (!selectedVariantId || !filteredByCategoryVariants.some((v: any) => v.product_variant_id === parseInt(selectedVariantId))) {
        setSelectedVariantId(String(filteredByCategoryVariants[0].product_variant_id));
      }
    } else if (livestockVariants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(String(livestockVariants[0].product_variant_id));
    }
  }, [selectedCategory, stockStatus]);

  // Recalculate computed total weight from bird quantities
  useEffect(() => {
    if (!isManualWeightOverride) {
      const presets = BIRD_WEIGHT_PRESETS[selectedCategory];
      const total = smallCount * presets.smallKg + mediumCount * presets.mediumKg + largeCount * presets.largeKg;
      if (total > 0) {
        setWeightKg(total.toFixed(3));
      } else if (smallCount === 0 && mediumCount === 0 && largeCount === 0 && weightKg === '0.000') {
        setWeightKg('0.000');
      }
    }
  }, [smallCount, mediumCount, largeCount, selectedCategory, isManualWeightOverride]);

  const logLossMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LOG_LIVESTOCK_LOSS, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (!isOpen) return null;

  const presets = BIRD_WEIGHT_PRESETS[selectedCategory];
  const totalBirdsCount = smallCount + mediumCount + largeCount;

  const handleCategoryChange = (cat: BirdCategory) => {
    setSelectedCategory(cat);
    setIsManualWeightOverride(false);
  };

  const handleCountChange = (size: 'small' | 'medium' | 'large', delta: number) => {
    setIsManualWeightOverride(false);
    if (size === 'small') setSmallCount(prev => Math.max(0, prev + delta));
    if (size === 'medium') setMediumCount(prev => Math.max(0, prev + delta));
    if (size === 'large') setLargeCount(prev => Math.max(0, prev + delta));
  };

  const handleManualWeightChange = (val: string) => {
    setIsManualWeightOverride(true);
    setWeightKg(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedVariantId) {
      setErrorMsg('Please select a product variant');
      return;
    }
    const qty = parseFloat(weightKg);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Please enter bird counts or a valid positive weight');
      return;
    }

    const noteSegments: string[] = [];
    if (totalBirdsCount > 0) {
      const countsDesc = [
        smallCount > 0 ? `${smallCount} Small (${presets.smallKg}kg)` : null,
        mediumCount > 0 ? `${mediumCount} Medium (${presets.mediumKg}kg)` : null,
        largeCount > 0 ? `${largeCount} Large (${presets.largeKg}kg)` : null,
      ].filter(Boolean).join(', ');
      noteSegments.push(`Mortality count: ${totalBirdsCount} birds [${countsDesc}]`);
    }
    if (notes.trim()) {
      noteSegments.push(notes.trim());
    }

    try {
      await logLossMutation.mutateAsync({
        product_variant_id: parseInt(selectedVariantId),
        quantity: qty,
        notes: noteSegments.join(' | ') || undefined,
      });

      setSuccessMsg(`Successfully logged ${qty.toFixed(3)} kg Livestock Loss (${totalBirdsCount > 0 ? `${totalBirdsCount} birds` : 'weighed loss'})!`);
      queryClient.invalidateQueries({ queryKey: ['stock-status'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log livestock loss');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500 font-black">
              <Bird size={22} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-text-primary">Log Dead Stock / Livestock Loss</h2>
              <p className="text-xs text-text-muted">Direct quantity logging for Chicken, Country Chicken, and Quails.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-app text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[85vh]">
          {/* 1. Category Quick-Selector (Live Bird Types) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Select Livestock Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCategoryChange('chicken')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  selectedCategory === 'chicken'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-subtle'
                    : 'bg-surface-app border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span className="text-base">🐓</span>
                <span>Chicken (Broiler)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange('country_chicken')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  selectedCategory === 'country_chicken'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-subtle'
                    : 'bg-surface-app border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span className="text-base">🦃</span>
                <span>Country Chicken</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange('quail')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  selectedCategory === 'quail'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-subtle'
                    : 'bg-surface-app border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span className="text-base">🐤</span>
                <span>Quails (Kaada)</span>
              </button>
            </div>
          </div>

          {/* Product Variant Matching */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Stock Item Inventory Mapping</label>
            <select
              value={selectedVariantId}
              onChange={e => setSelectedVariantId(e.target.value)}
              required
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-rose-500"
            >
              {filteredByCategoryVariants.length > 0 ? (
                filteredByCategoryVariants.map((s: any) => (
                  <option key={s.product_variant_id} value={s.product_variant_id}>
                    {s.product_name} - {s.variant_name} ({s.unit_type === 'weight' ? `${((s.quantity_grams ?? 0)/1000).toFixed(2)} kg in stock` : `${s.quantity_units ?? 0} pcs`})
                  </option>
                ))
              ) : (
                livestockVariants.map((s: any) => (
                  <option key={s.product_variant_id} value={s.product_variant_id}>
                    {s.product_name} - {s.variant_name} ({s.unit_type === 'weight' ? `${((s.quantity_grams ?? 0)/1000).toFixed(2)} kg in stock` : `${s.quantity_units ?? 0} pcs`})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Live Bird Size & Quantity Input Cards */}
          <div className="space-y-2 bg-surface-card p-3.5 rounded-2xl border border-border-subtle">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-brand-500 uppercase tracking-wider flex items-center gap-1.5">
                <Bird size={14} /> Enter Live Bird Loss Quantities
              </label>
              {totalBirdsCount > 0 && (
                <span className="text-xs font-bold font-mono text-text-primary bg-surface-panel px-2 py-0.5 rounded border border-border-subtle">
                  Total: {totalBirdsCount} bird{totalBirdsCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Small Bird Counter */}
              <div className="bg-surface-panel p-2.5 rounded-xl border border-border-subtle flex flex-col items-center space-y-1.5">
                <span className="text-xs font-bold text-text-primary">🐤 Small</span>
                <span className="text-[9px] text-text-muted font-mono">~{presets.smallKg} kg / bird</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCountChange('small', -1)}
                    className="w-7 h-7 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle text-text-primary flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={smallCount}
                    onChange={e => {
                      setIsManualWeightOverride(false);
                      setSmallCount(Math.max(0, parseInt(e.target.value) || 0));
                    }}
                    className="w-10 text-center font-mono font-bold text-xs bg-surface-card border border-border-subtle rounded-lg py-1 text-text-primary outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange('small', 1)}
                    className="w-7 h-7 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 text-brand-500 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Medium Bird Counter */}
              <div className="bg-surface-panel p-2.5 rounded-xl border border-border-subtle flex flex-col items-center space-y-1.5">
                <span className="text-xs font-bold text-text-primary">🐓 Medium</span>
                <span className="text-[9px] text-text-muted font-mono">~{presets.mediumKg} kg / bird</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCountChange('medium', -1)}
                    className="w-7 h-7 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle text-text-primary flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={mediumCount}
                    onChange={e => {
                      setIsManualWeightOverride(false);
                      setMediumCount(Math.max(0, parseInt(e.target.value) || 0));
                    }}
                    className="w-10 text-center font-mono font-bold text-xs bg-surface-card border border-border-subtle rounded-lg py-1 text-text-primary outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange('medium', 1)}
                    className="w-7 h-7 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 text-brand-500 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Large Bird Counter */}
              <div className="bg-surface-panel p-2.5 rounded-xl border border-border-subtle flex flex-col items-center space-y-1.5">
                <span className="text-xs font-bold text-text-primary">🦃 Large</span>
                <span className="text-[9px] text-text-muted font-mono">~{presets.largeKg} kg / bird</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCountChange('large', -1)}
                    className="w-7 h-7 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle text-text-primary flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={largeCount}
                    onChange={e => {
                      setIsManualWeightOverride(false);
                      setLargeCount(Math.max(0, parseInt(e.target.value) || 0));
                    }}
                    className="w-10 text-center font-mono font-bold text-xs bg-surface-card border border-border-subtle rounded-lg py-1 text-text-primary outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange('large', 1)}
                    className="w-7 h-7 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/40 text-brand-500 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {totalBirdsCount > 0 && (
              <div className="text-[10px] text-text-secondary bg-surface-panel p-2 rounded-lg border border-border-subtle flex items-center justify-between font-mono">
                <span>Calculated Breakdown:</span>
                <span className="font-bold text-text-primary">
                  {[
                    smallCount > 0 ? `${smallCount}s (${(smallCount * presets.smallKg).toFixed(2)}kg)` : null,
                    mediumCount > 0 ? `${mediumCount}m (${(mediumCount * presets.mediumKg).toFixed(2)}kg)` : null,
                    largeCount > 0 ? `${largeCount}l (${(largeCount * presets.largeKg).toFixed(2)}kg)` : null,
                  ].filter(Boolean).join(' + ')}
                </span>
              </div>
            )}
          </div>

          {/* 3. Primary Weighed Loss Weight Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                Total Weighed Loss (kg) *
              </label>
              {isManualWeightOverride && (
                <span className="text-[9px] font-bold text-amber-400">Scale Weight Overridden</span>
              )}
            </div>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={weightKg}
              onChange={e => handleManualWeightChange(e.target.value)}
              required
              className="w-full bg-surface-app border border-rose-500/40 rounded-xl px-3.5 py-2.5 text-base font-mono font-black text-rose-500 outline-none focus:border-rose-500 shadow-sm"
              placeholder="0.000"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-muted uppercase">Remarks / Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Crate mortality from morning delivery..."
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-rose-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} /> {successMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={logLossMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              <Bird size={14} />
              {logLossMutation.isPending ? 'Submitting...' : 'Log Dead Stock Loss'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
