import React, { useState, useMemo } from 'react';
import { X, Snowflake, Plus, Search, Calendar, DollarSign, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { useRecordFridgeAddition } from '../hooks/useRefrigeratorStock';

interface ProductItem {
  id: number;
  product_id: number;
  product_name: string;
  variant_name: string;
  category: string;
  product_code: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  cost_price_paise_per_unit: number;
  stock_classification?: string;
}

interface FridgeAddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVariantId?: number | null;
  branchId?: number;
}

export default function FridgeAddStockModal({
  isOpen,
  onClose,
  initialVariantId,
  branchId = 1,
}: FridgeAddStockModalProps) {
  const addMutation = useRecordFridgeAddition();

  // Fetch all products/variants for billing-like fast search
  const { data: rawProducts = [] } = useQuery<ProductItem[]>({
    queryKey: ['products', 'all-for-fridge'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PRODUCTS.GET_ALL);
      if (!res.success) throw new Error(res.error?.message || 'Failed to load products');
      return res.data || [];
    },
    enabled: isOpen,
  });

  const allProducts = useMemo(() => Array.isArray(rawProducts) ? rawProducts : [], [rawProducts]);

  const [search, setSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(initialVariantId || null);
  const [quantity, setQuantity] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [costPrice, setCostPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync initial variant if supplied
  React.useEffect(() => {
    if (initialVariantId) {
      setSelectedVariantId(initialVariantId);
    }
  }, [initialVariantId]);

  const selectedVariant = useMemo(() => {
    return allProducts.find(p => p.id === selectedVariantId) || null;
  }, [allProducts, selectedVariantId]);

  // Set default cost price when variant selected
  React.useEffect(() => {
    if (selectedVariant && !costPrice) {
      const costRupees = (selectedVariant.cost_price_paise_per_unit || 0) / 100;
      if (costRupees > 0) {
        setCostPrice(String(costRupees));
      }
    }
  }, [selectedVariant]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 20);
    const q = search.toLowerCase().trim();
    return allProducts.filter(p => {
      const name = (p.product_name || '').toLowerCase();
      const variant = (p.variant_name || '').toLowerCase();
      const code = (p.product_code || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || variant.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 30);
  }, [allProducts, search]);

  if (!isOpen) return null;

  const isWeight = selectedVariant ? (selectedVariant.unit_type === 'weight' || selectedVariant.unit_type === 'live_dual') : true;
  const unitLabel = isWeight ? 'kg' : 'pcs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedVariantId || !selectedVariant) {
      setError('Please select a product variant to add.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError(`Please enter a valid quantity greater than 0 ${unitLabel}.`);
      return;
    }

    const costPaise = costPrice ? Math.round(parseFloat(costPrice) * 100) : undefined;

    try {
      const result = await addMutation.mutateAsync({
        product_variant_id: selectedVariantId,
        quantity: qtyNum,
        unit_type: selectedVariant.unit_type,
        entry_date: entryDate,
        cost_price_paise_per_unit: costPaise,
        notes: notes.trim() || undefined,
        branch_id: branchId,
      });

      setSuccessMsg(result.message || 'Stock added to refrigerator successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to deposit stock into refrigerator.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel">
          <div className="flex items-center gap-2.5 text-cyan-400 font-bold">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <Snowflake size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Put Items into Refrigerator</h2>
              <p className="text-[11px] text-text-muted">Direct cold room deposit with auto-dated freshness tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover text-text-muted hover:text-text-primary rounded-xl transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Product Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary flex items-center justify-between">
              <span>Select Product / Meat Cut</span>
              {selectedVariant && (
                <span className="text-[10px] text-cyan-400 font-normal">
                  Selected: {selectedVariant.product_name} ({selectedVariant.variant_name || 'Standard'})
                </span>
              )}
            </label>

            {!selectedVariantId ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search product name, category, or code..."
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-44 overflow-y-auto border border-border-subtle rounded-xl divide-y divide-border-subtle/50 bg-surface-panel">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text-muted">No matching products found</div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedVariantId(p.id);
                          setSearch('');
                        }}
                        className="w-full text-left p-2.5 hover:bg-cyan-500/10 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-text-primary">{p.product_name}</div>
                          <div className="text-[10px] text-text-muted">
                            {p.variant_name || 'Standard'} • {p.category || 'General'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-card border border-border-subtle text-text-secondary font-mono">
                            {p.unit_type === 'weight' ? 'Weight (kg)' : 'Piece'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-surface-panel border border-cyan-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-text-primary">{selectedVariant?.product_name}</div>
                  <div className="text-[10px] text-text-muted">
                    {selectedVariant?.variant_name || 'Standard'} • {selectedVariant?.category} • Unit: {unitLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVariantId(null)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline"
                >
                  Change Product
                </button>
              </div>
            )}
          </div>

          {/* Quantity & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
                <span>Deposit Quantity ({unitLabel})</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={isWeight ? '0.001' : '1'}
                  min="0.001"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder={isWeight ? 'e.g. 5.500 kg' : 'e.g. 10'}
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary placeholder:text-text-muted outline-none focus:border-cyan-500"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                  {unitLabel}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
                <Calendar size={12} className="text-cyan-400" />
                <span>Storage Date (Defaults to Today)</span>
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Cost Price & Storage Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-400" />
                <span>Unit Cost (₹ per {unitLabel})</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00 (Optional)"
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
                <Tag size={12} className="text-text-muted" />
                <span>Storage / Batch Note</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Morning Cut, Tray #1"
                className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || !selectedVariantId || !quantity}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>{addMutation.isPending ? 'Adding...' : 'Put In Refrigerator'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
