import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, AlertCircle, Search, Trash2, Send, Plus, Store } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { useStockStatus } from '../hooks/useInventory';
import { useActiveBranches } from '../hooks/useBranches';

interface TransferItemRow {
  variant_id: number;
  product_name: string;
  variant_name: string;
  product_code: string;
  is_weight: boolean;
  unit_label: string;
  available_stock: number;
  quantity: number;
  unit_cost_rupees: number;
}

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StockTransferModal({ isOpen, onClose }: StockTransferModalProps) {
  const queryClient = useQueryClient();
  const { data: branches } = useActiveBranches();
  const { data: stockStatus } = useStockStatus();

  const [fromBranchId, setFromBranchId] = useState<number>(1);
  const [toBranchId, setToBranchId] = useState<number>(2);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Billing style list
  const [transferList, setTransferList] = useState<TransferItemRow[]>([]);

  // Search & Type-ahead
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightIndex, setHighlightIndex] = useState<number>(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Ensure default branch IDs if branches load
  useEffect(() => {
    if (branches && branches.length >= 2) {
      if (!fromBranchId) setFromBranchId(branches[0].id);
      if (!toBranchId || toBranchId === branches[0].id) {
        const other = branches.find(b => b.id !== branches[0].id);
        if (other) setToBranchId(other.id);
      }
    }
  }, [branches]);

  // Autofocus search on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setTransferList([]);
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const initiateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.INITIATE_TRANSFER, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
    }
  });

  // Filtered matching products
  const matchingProducts = useMemo(() => {
    if (!searchTerm.trim() || !stockStatus) return [];
    const q = searchTerm.toLowerCase().trim();
    return stockStatus.filter(item => {
      const pName = (item.product_name || '').toLowerCase();
      const vName = (item.variant_name || '').toLowerCase();
      const code = (item.product_code || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return pName.includes(q) || vName.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 8);
  }, [stockStatus, searchTerm]);

  useEffect(() => {
    setHighlightIndex(0);
    setIsDropdownOpen(matchingProducts.length > 0 && searchTerm.trim().length > 0);
  }, [matchingProducts, searchTerm]);

  if (!isOpen) return null;

  const handleSelectProduct = (product: any) => {
    const isWeight = product.unit_type === 'weight' || product.unit_type === 'live_dual';
    const currentStock = isWeight 
      ? ((product.quantity_grams ?? 0) / 1000) 
      : (product.quantity_units ?? 0);

    const unitCostPaise = product.last_purchase_cost_paise || product.unit_cost_paise_cache || product.current_rate_paise_per_unit || 0;
    const unitCostRupees = Number((unitCostPaise / 100).toFixed(2));

    const existingIndex = transferList.findIndex(item => item.variant_id === product.product_variant_id);

    if (existingIndex >= 0) {
      // Focus existing item's quantity input
      setSearchTerm('');
      setIsDropdownOpen(false);
      setTimeout(() => {
        qtyInputRefs.current[product.product_variant_id]?.focus();
        qtyInputRefs.current[product.product_variant_id]?.select();
      }, 50);
    } else {
      const newRow: TransferItemRow = {
        variant_id: product.product_variant_id,
        product_name: product.product_name,
        variant_name: product.variant_name,
        product_code: product.product_code,
        is_weight: isWeight,
        unit_label: isWeight ? 'kg' : 'pcs',
        available_stock: currentStock,
        quantity: 1,
        unit_cost_rupees: unitCostRupees,
      };

      setTransferList(prev => [...prev, newRow]);
      setSearchTerm('');
      setIsDropdownOpen(false);

      // Immediately focus the quantity field of the newly added row
      setTimeout(() => {
        qtyInputRefs.current[product.product_variant_id]?.focus();
        qtyInputRefs.current[product.product_variant_id]?.select();
      }, 50);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || matchingProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % matchingProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + matchingProducts.length) % matchingProducts.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (matchingProducts[highlightIndex]) {
        handleSelectProduct(matchingProducts[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus back to the search bar for continuous rapid keyboard entry
      searchInputRef.current?.focus();
    }
  };

  const handleUpdateRow = (variantId: number, field: 'quantity' | 'unit_cost_rupees', value: number) => {
    setTransferList(prev => prev.map(item => {
      if (item.variant_id === variantId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveRow = (variantId: number) => {
    setTransferList(prev => prev.filter(item => item.variant_id !== variantId));
  };

  const totalTransferCostRupees = transferList.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_cost_rupees);
  }, 0);

  const handleDispatch = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (fromBranchId === toBranchId) {
      setErrorMsg('Source branch and destination branch must be different.');
      return;
    }

    if (transferList.length === 0) {
      setErrorMsg('Please add at least one product to the transfer list.');
      return;
    }

    // Validate quantities
    for (const item of transferList) {
      if (!item.quantity || item.quantity <= 0) {
        setErrorMsg(`Invalid quantity for ${item.product_name} (${item.variant_name}).`);
        return;
      }
    }

    try {
      const res = await initiateMutation.mutateAsync({
        from_location_id: fromBranchId,
        to_location_id: toBranchId,
        items: transferList.map(i => ({
          product_variant_id: i.variant_id,
          quantity: i.quantity,
          unit_cost_paise: Math.round(i.unit_cost_rupees * 100),
        })),
        notes: notes.trim() || undefined,
      });

      setSuccessMsg(`Transfer ${res.transfer_number} dispatched successfully!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch stock transfer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Stock Transfer Dispatch</h2>
              <p className="text-xs text-text-muted">Type-ahead fast keyboard entry for multi-product branch stock transfer.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Source & Destination Strip */}
        <div className="p-4 bg-surface-app border-b border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1.5">
              <Store size={13} className="text-brand-500" /> Source Branch (Dispatching From)
            </label>
            <select
              value={fromBranchId}
              onChange={e => setFromBranchId(Number(e.target.value))}
              className="w-full h-10 bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500 box-border"
            >
              {branches && branches.length > 0 ? (
                branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) {b.is_default === 1 ? '— Primary' : ''}
                  </option>
                ))
              ) : (
                <option value={1}>Main Store (BR-MAIN) — Primary</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1.5">
              <Store size={13} className="text-brand-500" /> Destination Branch (Receiving At)
            </label>
            <select
              value={toBranchId}
              onChange={e => setToBranchId(Number(e.target.value))}
              className="w-full h-10 bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500 box-border"
            >
              {branches && branches.length > 0 ? (
                branches.map(b => (
                  <option key={b.id} value={b.id} disabled={b.id === fromBranchId}>
                    {b.name} ({b.code}) {b.id === fromBranchId ? '(Source)' : ''}
                  </option>
                ))
              ) : (
                <option value={2}>Branch Store 1 (BR-BRANCH-1)</option>
              )}
            </select>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Fast Search Input Bar */}
        <div className="p-4 relative shrink-0 border-b border-border-subtle/60">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search product by name or code... (Press Enter to add to transfer list)"
              className="w-full bg-surface-app border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-brand-500 shadow-inner"
            />
          </div>

          {/* Typeahead Dropdown */}
          {isDropdownOpen && matchingProducts.length > 0 && (
            <div className="absolute left-4 right-4 top-[calc(100%-4px)] z-30 bg-surface-panel border border-border-subtle rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-border-subtle/50">
              {matchingProducts.map((p, idx) => {
                const isSelected = idx === highlightIndex;
                const isWeight = p.unit_type === 'weight' || p.unit_type === 'live_dual';
                const stock = isWeight ? ((p.quantity_grams ?? 0) / 1000) : (p.quantity_units ?? 0);

                return (
                  <div
                    key={p.product_variant_id}
                    onClick={() => handleSelectProduct(p)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand-500/15 text-brand-400' : 'hover:bg-surface-app'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-text-primary">{p.product_name}</span>
                      <span className="text-xs text-text-muted ml-2">({p.variant_name})</span>
                      <span className="text-[10px] font-mono text-text-muted ml-2">[{p.product_code}]</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-muted">Stock: <strong className="text-text-primary font-mono">{stock.toFixed(2)} {isWeight ? 'kg' : 'pcs'}</strong></span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400">
                        + Add [Enter]
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transfer Item List */}
        <div className="p-4 overflow-y-auto flex-1">
          {transferList.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs flex flex-col items-center justify-center gap-2">
              <Plus size={28} className="text-text-muted/40" />
              <span>No items added to transfer list. Use the search bar above to type and press Enter.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Product / Item</th>
                  <th className="py-2.5 px-3 text-right">Available Stock</th>
                  <th className="py-2.5 px-3 text-right w-36">Transfer Quantity</th>
                  <th className="py-2.5 px-3 text-right w-36">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                  <th className="py-2.5 px-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {transferList.map(item => (
                  <tr key={item.variant_id} className="hover:bg-surface-app/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-text-primary">{item.product_name}</div>
                      <div className="text-[11px] text-text-muted">{item.variant_name} <span className="font-mono">[{item.product_code}]</span></div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-text-muted">
                      {item.available_stock.toFixed(2)} {item.unit_label}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          ref={el => { qtyInputRefs.current[item.variant_id] = el; }}
                          type="number"
                          step={item.is_weight ? '0.05' : '1'}
                          min="0.001"
                          value={item.quantity}
                          onChange={e => handleUpdateRow(item.variant_id, 'quantity', parseFloat(e.target.value) || 0)}
                          onKeyDown={handleQtyKeyDown}
                          className="w-24 text-right bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                        />
                        <span className="text-text-muted text-[11px] w-6">{item.unit_label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={item.unit_cost_rupees}
                        onChange={e => handleUpdateRow(item.variant_id, 'unit_cost_rupees', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                      ₹{(item.quantity * item.unit_cost_rupees).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(item.variant_id)}
                        className="p-1 text-text-muted hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer & Dispatch Bar */}
        <div className="p-4 bg-surface-app border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs w-full sm:w-auto">
            <span className="text-text-muted">Total Items: <strong className="text-text-primary font-mono">{transferList.length}</strong></span>
            <span className="text-text-muted">Transfer Valuation: <strong className="text-brand-400 font-mono text-sm">₹{totalTransferCostRupees.toFixed(2)}</strong></span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <input
              type="text"
              placeholder="Transfer notes / vehicle # (optional)..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500 w-56"
            />
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border-subtle text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDispatch}
              disabled={initiateMutation.isPending || transferList.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Send size={14} /> {initiateMutation.isPending ? 'Dispatching...' : 'Initiate & Dispatch Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
