import { useState, useMemo, useRef, useEffect, type KeyboardEvent } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  LogOut, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  ShieldCheck, 
  Building2, 
  Settings, 
  RefreshCw, 
  History, 
  Hash, 
  X,
  Trash2,
  Calendar,
  Layers,
  Snowflake,
  CheckCircle2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveRates } from '../../../billing/frontend/hooks/useActiveRates';
import type { ProductVariant } from '../../../billing/frontend/types/billing.types';
import { 
  useRefrigeratorStock, 
  useFridgeActivityLog,
  useRecordFridgeAddition,
  RefrigeratorStockItem 
} from '../hooks/useRefrigeratorStock';
import FridgeTakeOutModal from './FridgeTakeOutModal';
import { useActiveBranches } from '../hooks/useBranches';
import { ErrorBoundary } from '../../../../core/shared/ErrorBoundary';

interface StagedFridgeItem {
  tempId: string;
  variant: ProductVariant;
  quantity: number;
  entryDate: string;
  unitType: 'weight' | 'piece' | 'live_dual';
}

function RefrigeratorStockViewInner() {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const { data: rawBranches } = useActiveBranches();
  const branches = useMemo(() => Array.isArray(rawBranches) ? rawBranches : [], [rawBranches]);

  // Main Tab State: 'stock' | 'activity'
  const [currentTab, setCurrentTab] = useState<'stock' | 'activity'>('stock');

  const { data: rawFridgeItems, isLoading, isError, error, refetch } = useRefrigeratorStock(selectedBranchId);
  const safeFridgeItems = useMemo(() => Array.isArray(rawFridgeItems) ? rawFridgeItems : [], [rawFridgeItems]);

  const { data: rawActivityLogs = [], isLoading: isLoadingActivity, refetch: refetchActivity } = useFridgeActivityLog(selectedBranchId, 100);
  const activityLogs = useMemo(() => Array.isArray(rawActivityLogs) ? rawActivityLogs : [], [rawActivityLogs]);

  // Active product variants from POS billing
  const { data: rawVariants = [] } = useActiveRates();
  const allVariants = useMemo(() => {
    const arr = Array.isArray(rawVariants) ? [...rawVariants] : [];
    return arr.sort((a, b) => `${a.product_name} ${a.variant_name}`.localeCompare(`${b.product_name} ${b.variant_name}`));
  }, [rawVariants]);

  // Entry date state (default today, editable so user can add with any date)
  const [currentEntryDate, setCurrentEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Search & Staging List State (Billing Cart Style)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Staged items awaiting commit (Cart)
  const [stagedItems, setStagedItems] = useState<StagedFridgeItem[]>([]);

  const productInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const addMutation = useRecordFridgeAddition();

  // Auto-focus on product search input on mount
  useEffect(() => {
    productInputRef.current?.focus();
  }, []);

  // When a product variant is selected, clear inputs and focus quantity field
  useEffect(() => {
    let t: NodeJS.Timeout | undefined;
    if (selectedVariant) {
      setQuantityInput('');
      setAmountInput('');
      setSearchError('');
      requestAnimationFrame(() => quantityInputRef.current?.focus());
      t = setTimeout(() => quantityInputRef.current?.focus(), 50);
    } else {
      requestAnimationFrame(() => productInputRef.current?.focus());
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [selectedVariant]);

  // Global Space key handler to commit all staged items into Refrigerator
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
        if (!isInputFocused && stagedItems.length > 0 && !isCommitting) {
          e.preventDefault();
          commitAllStagedItems();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [stagedItems, isCommitting]);

  const handleEscape = () => {
    if (selectedVariant) {
      setSelectedVariant(null);
      setQuantityInput('');
      setAmountInput('');
      setSearchError('');
    }
    setSearchTerm('');
    requestAnimationFrame(() => productInputRef.current?.focus());
  };

  const chooseByNumberOrCode = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscape();
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    // 1. Match by product_code (e.g. "1", "101", "PRD-00001")
    const matchByCode = allVariants.find(v => v.product_code?.toLowerCase() === term.toLowerCase());
    if (matchByCode) {
      setSelectedVariant(matchByCode);
      return;
    }

    // 2. Match by sequential 1-based index (e.g. typing "1" for 1st product)
    const quickNumber = Number(term);
    if (Number.isInteger(quickNumber) && quickNumber >= 1 && allVariants[quickNumber - 1]) {
      setSelectedVariant(allVariants[quickNumber - 1]);
      return;
    }

    // 3. Match by product name contains
    const matchByName = allVariants.find(v => `${v.product_name} ${v.variant_name}`.toLowerCase().includes(term.toLowerCase()));
    if (matchByName) {
      setSelectedVariant(matchByName);
      return;
    }

    setSearchError(`No product found for code/number "${term}".`);
  };

  // Stage selected product to the pending list (Cart) on Enter
  const stageProduct = (source: 'quantity' | 'amount') => {
    if (!selectedVariant) return;
    const entered = Number(source === 'quantity' ? quantityInput : amountInput);
    if (!Number.isFinite(entered) || entered <= 0) {
      setSearchError(`Please enter a valid ${source} greater than 0.`);
      return;
    }

    const rate = selectedVariant.current_rate_paise_per_unit || 0;
    const isWeightType = selectedVariant.unit_type === 'weight' || selectedVariant.unit_type === 'live_dual';
    let finalQty = 0;

    if (source === 'amount' && rate > 0) {
      finalQty = isWeightType 
        ? Math.round((entered * 100 * 1000) / rate) / 1000 
        : Math.round((entered * 100) / rate);
    } else {
      finalQty = entered;
    }

    if (finalQty <= 0) {
      setSearchError('Quantity or amount is too small.');
      return;
    }

    const newItem: StagedFridgeItem = {
      tempId: `${selectedVariant.id}-${Date.now()}-${Math.random()}`,
      variant: selectedVariant,
      quantity: finalQty,
      entryDate: currentEntryDate,
      unitType: selectedVariant.unit_type,
    };

    setStagedItems(prev => [...prev, newItem]);
    setSelectedVariant(null);
    setQuantityInput('');
    setAmountInput('');
    setSearchTerm('');
    setSearchError('');

    requestAnimationFrame(() => productInputRef.current?.focus());
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const updateStagedItemQty = (tempId: string, newQty: number) => {
    if (newQty <= 0) return;
    setStagedItems(prev => prev.map(item => item.tempId === tempId ? { ...item, quantity: newQty } : item));
  };

  const removeStagedItem = (tempId: string) => {
    setStagedItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Commit all staged items to Refrigerator inventory
  const commitAllStagedItems = async () => {
    if (stagedItems.length === 0 || isCommitting) return;
    setIsCommitting(true);
    setSearchError('');

    try {
      for (const item of stagedItems) {
        await addMutation.mutateAsync({
          product_variant_id: item.variant.id,
          quantity: item.quantity,
          unit_type: item.unitType,
          entry_date: item.entryDate,
          branch_id: selectedBranchId,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'refrigerator-stock'] });
      refetch();
      refetchActivity();

      const count = stagedItems.length;
      setStagedItems([]);
      setSuccessMsg(`Successfully moved ${count} product${count > 1 ? 's' : ''} to Refrigerator Inventory!`);
      setTimeout(() => setSuccessMsg(null), 3500);

      requestAnimationFrame(() => productInputRef.current?.focus());
      setTimeout(() => productInputRef.current?.focus(), 50);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to commit items into refrigerator inventory.');
    } finally {
      setIsCommitting(false);
    }
  };

  const quickIndex = selectedVariant ? allVariants.findIndex(v => v.id === selectedVariant.id) : -1;

  // Table filtering and search states
  const [tableSearch, setTableSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [ageFilter, setAgeFilter] = useState<'ALL' | 'FRESH' | 'AGING' | 'CRITICAL'>('ALL');

  // Configurable aging day thresholds (editable in UI)
  const [freshMaxDays, setFreshMaxDays] = useState<number>(2); // 0-2 days = Fresh
  const [warningMaxDays, setWarningMaxDays] = useState<number>(4); // 3-4 days = Warning, 5+ = Critical
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);

  // Take Out Modal State
  const [selectedItemForTakeOut, setSelectedItemForTakeOut] = useState<RefrigeratorStockItem | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeFridgeItems.forEach(i => {
      if (i && i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [safeFridgeItems]);

  const filteredItems = useMemo(() => {
    return safeFridgeItems.filter(item => {
      if (!item) return false;
      const days = typeof item.days_in_fridge === 'number' && !isNaN(item.days_in_fridge) ? item.days_in_fridge : 0;

      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      // Age filter
      if (ageFilter === 'FRESH' && days > freshMaxDays) return false;
      if (ageFilter === 'AGING' && (days <= freshMaxDays || days > warningMaxDays)) return false;
      if (ageFilter === 'CRITICAL' && days <= warningMaxDays) return false;

      // Table search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchName = (item.product_name || '').toLowerCase().includes(q);
        const matchVariant = (item.variant_name || '').toLowerCase().includes(q);
        const matchCode = (item.product_code || '').toLowerCase().includes(q);
        const matchBatch = (item.batch_number || item.oldest_batch_number || '').toLowerCase().includes(q);
        if (!matchName && !matchVariant && !matchCode && !matchBatch) return false;
      }

      return true;
    });
  }, [safeFridgeItems, categoryFilter, ageFilter, tableSearch, freshMaxDays, warningMaxDays]);

  // Aggregate stats
  const totalStockKg = useMemo(() => {
    return safeFridgeItems.reduce((sum, i) => {
      const qty = typeof i?.quantity === 'number' && !isNaN(i.quantity) ? i.quantity : 0;
      return i?.unit_type === 'weight' || i?.unit_type === 'live_dual' ? sum + qty : sum;
    }, 0);
  }, [safeFridgeItems]);

  const totalStockPcs = useMemo(() => {
    return safeFridgeItems.reduce((sum, i) => {
      const qty = typeof i?.quantity === 'number' && !isNaN(i.quantity) ? i.quantity : 0;
      return i?.unit_type !== 'weight' && i?.unit_type !== 'live_dual' ? sum + qty : sum;
    }, 0);
  }, [safeFridgeItems]);

  const freshCount = useMemo(() => {
    return safeFridgeItems.filter(i => {
      const days = typeof i?.days_in_fridge === 'number' && !isNaN(i.days_in_fridge) ? i.days_in_fridge : 0;
      return days <= freshMaxDays;
    }).length;
  }, [safeFridgeItems, freshMaxDays]);

  const agingCount = useMemo(() => {
    return safeFridgeItems.filter(i => {
      const days = typeof i?.days_in_fridge === 'number' && !isNaN(i.days_in_fridge) ? i.days_in_fridge : 0;
      return days > freshMaxDays && days <= warningMaxDays;
    }).length;
  }, [safeFridgeItems, freshMaxDays, warningMaxDays]);

  const criticalCount = useMemo(() => {
    return safeFridgeItems.filter(i => {
      const days = typeof i?.days_in_fridge === 'number' && !isNaN(i.days_in_fridge) ? i.days_in_fridge : 0;
      return days > warningMaxDays;
    }).length;
  }, [safeFridgeItems, warningMaxDays]);

  const handleRefresh = () => {
    refetch();
    refetchActivity();
  };

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-3 space-y-3 overflow-hidden">
      {/* Top 1/3 Section: Entry Bar + Staged Items Cart (Same as in Billing) */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-3 space-y-2 shadow-sm flex-shrink-0">
        {/* Header line with date picker, branch, and clear button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Add Items to Refrigerator Inventory
            </label>

            {/* Editable Entry Date (defaults to today, customizable for any date) */}
            <div className="flex items-center gap-1 bg-surface-card border border-border-subtle rounded-lg px-2 py-0.5 text-xs text-text-secondary">
              <Calendar size={12} className="text-emerald-400" />
              <span className="text-[10px] text-text-muted">Storage Date:</span>
              <input
                type="date"
                value={currentEntryDate}
                onChange={e => setCurrentEntryDate(e.target.value)}
                className="bg-transparent text-text-primary font-mono text-xs outline-none cursor-pointer font-bold"
                title="Select storage date for incoming items"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <div className="flex items-center gap-1.5 bg-surface-card px-2.5 py-0.5 rounded-lg border border-border-subtle text-[11px]">
                <Building2 size={12} className="text-brand-500" />
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(Number(e.target.value))}
                  className="bg-transparent text-text-primary font-bold outline-none cursor-pointer text-[11px]"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedVariant && (
              <button
                onClick={() => {
                  setSelectedVariant(null);
                  setQuantityInput('');
                  setAmountInput('');
                  setSearchError('');
                  requestAnimationFrame(() => productInputRef.current?.focus());
                }}
                className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1 bg-surface-card px-2 py-0.5 rounded border border-border-subtle"
              >
                <X size={12} /> Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Product Quick Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="refrigerator-product-search-input"
              ref={productInputRef}
              inputMode="text"
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
                setSearchError('');
              }}
              onKeyDown={chooseByNumberOrCode}
              placeholder="Enter product code / quick # (e.g. 1, 2...) or product name, then Enter"
              className="w-full pl-9 pr-3 py-1.5 bg-surface-card border border-border-subtle rounded-lg text-sm font-bold font-mono text-text-primary outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Selected Product Card for Quantity / Amount Entry */}
        {selectedVariant && (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-text-primary">
                #{selectedVariant.product_code || (quickIndex !== -1 ? quickIndex + 1 : '')} · {selectedVariant.product_name} {selectedVariant.variant_name && selectedVariant.variant_name !== 'Standard' ? `— ${selectedVariant.variant_name}` : ''}
              </p>
              <span className="text-[11px] font-bold text-emerald-400 font-mono">
                ₹{((selectedVariant.current_rate_paise_per_unit || 0) / 100).toFixed(2)} / {(selectedVariant.unit_type === 'weight' || selectedVariant.unit_type === 'live_dual') ? 'kg' : 'pc'}
              </span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Enter quantity or total amount below, then press Enter to stage item in the list.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <input
                ref={quantityInputRef}
                inputMode="decimal"
                value={quantityInput}
                onChange={event => setQuantityInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    stageProduct('quantity');
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    handleEscape();
                  }
                }}
                placeholder={(selectedVariant.unit_type === 'weight' || selectedVariant.unit_type === 'live_dual') ? 'Quantity in KG (e.g. 1.5)' : 'Quantity in Pieces'}
                className="rounded-lg bg-surface-card border border-border-subtle px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-emerald-500"
              />
              <input
                inputMode="decimal"
                value={amountInput}
                onChange={event => setAmountInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    stageProduct('amount');
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    handleEscape();
                  }
                }}
                placeholder="Total Amount in ₹ (e.g. 250)"
                className="rounded-lg bg-surface-card border border-border-subtle px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Staged Items List (Cart) & Space-to-Commit Action */}
        {stagedItems.length > 0 && (
          <div className="bg-surface-card border border-border-subtle rounded-xl p-2 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary border-b border-border-subtle pb-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <Layers size={13} />
                <span>Staged Items to Move into Refrigerator ({stagedItems.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setStagedItems([])}
                className="text-[10px] text-text-muted hover:text-rose-400"
              >
                Clear List
              </button>
            </div>

            {/* List of staged items with inline quantity editing */}
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {stagedItems.map((item, idx) => {
                const isWeight = item.unitType === 'weight' || item.unitType === 'live_dual';
                return (
                  <div
                    key={item.tempId}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface-panel text-xs border border-border-subtle/60"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-text-muted font-bold w-4">#{idx + 1}</span>
                      <span className="font-extrabold text-text-primary truncate">{item.variant.product_name}</span>
                      {item.variant.variant_name && item.variant.variant_name !== 'Standard' && (
                        <span className="text-[10px] text-text-muted truncate">({item.variant.variant_name})</span>
                      )}
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-card text-text-muted border border-border-subtle flex-shrink-0">
                        {item.entryDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number"
                        step={isWeight ? '0.001' : '1'}
                        min="0.001"
                        value={item.quantity}
                        onChange={e => updateStagedItemQty(item.tempId, parseFloat(e.target.value) || 0)}
                        className="w-16 h-6 rounded bg-surface-card border border-border-subtle text-center text-xs font-mono font-bold text-text-primary outline-none focus:border-emerald-500"
                        title="Edit quantity"
                      />
                      <span className="text-[10px] font-bold text-text-muted w-5">{isWeight ? 'kg' : 'pcs'}</span>

                      <button
                        type="button"
                        onClick={() => removeStagedItem(item.tempId)}
                        className="h-6 w-6 flex items-center justify-center rounded text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Commit Button — SPACE bar shortcut */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-text-muted">
                Press <kbd className="px-1.5 py-0.5 rounded bg-surface-panel border border-border-subtle font-mono text-[10px] font-bold text-emerald-400">SPACE</kbd> anywhere to move all into inventory
              </span>
              <button
                type="button"
                onClick={commitAllStagedItems}
                disabled={isCommitting}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>{isCommitting ? 'Moving to Fridge...' : 'Move to Refrigerator (SPACE)'}</span>
              </button>
            </div>
          </div>
        )}

        {searchError && <p className="text-xs font-semibold text-rose-400">{searchError}</p>}
        {successMsg && (
          <p className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex items-center gap-1.5">
            <ShieldCheck size={14} />
            <span>{successMsg}</span>
          </p>
        )}
      </div>

      {/* Main 2/3 Section: Refrigerator Stock Levels Table */}
      <div className="flex-1 min-h-0 flex flex-col bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        {/* Navigation Sub-Tabs & Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between border-b border-border-subtle px-3 py-2 bg-surface-panel gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentTab('stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === 'stock'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Snowflake size={14} />
              <span>Refrigerator Stock Levels</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-card text-text-secondary">
                {filteredItems.length}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('activity')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === 'activity'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <History size={14} />
              <span>In-Out Movement Log</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-card text-text-secondary">
                {activityLogs.length}
              </span>
            </button>
          </div>

          {/* Quick Filters and Total Stock in Table Header */}
          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
            {/* Quick Freshness Filters */}
            <div className="flex items-center gap-1 bg-surface-card p-0.5 rounded-xl border border-border-subtle text-[10px]">
              <button
                onClick={() => setAgeFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  ageFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-400' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                All ({safeFridgeItems.length})
              </button>
              <button
                onClick={() => setAgeFilter('FRESH')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  ageFilter === 'FRESH' ? 'bg-emerald-500/20 text-emerald-400' : 'text-text-muted hover:text-emerald-400'
                }`}
              >
                Fresh ({freshCount})
              </button>
              <button
                onClick={() => setAgeFilter('AGING')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  ageFilter === 'AGING' ? 'bg-amber-500/20 text-amber-400' : 'text-text-muted hover:text-amber-400'
                }`}
              >
                Aging ({agingCount})
              </button>
              <button
                onClick={() => setAgeFilter('CRITICAL')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  ageFilter === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'text-text-muted hover:text-rose-400'
                }`}
              >
                Attention ({criticalCount})
              </button>
            </div>

            {/* Total Stock Badge */}
            <div className="hidden lg:flex items-center gap-1 bg-surface-card px-2.5 py-1 rounded-xl border border-border-subtle text-[11px] font-mono font-bold text-cyan-400">
              <span>Fridge Total:</span>
              <span>
                {totalStockKg > 0 ? `${totalStockKg.toFixed(1)}kg` : ''}
                {totalStockKg > 0 && totalStockPcs > 0 ? ' + ' : ''}
                {totalStockPcs > 0 ? `${totalStockPcs}pcs` : ''}
                {totalStockKg === 0 && totalStockPcs === 0 ? '0kg' : ''}
              </span>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search stock..."
                className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-2 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
              />
            </div>

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1 text-xs text-text-primary outline-none focus:border-brand-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowThresholdSettings(!showThresholdSettings)}
              className={`p-1.5 rounded-xl border text-xs font-semibold transition-all ${
                showThresholdSettings
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                  : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
              }`}
              title="Aging Settings"
            >
              <Settings size={13} />
            </button>

            <button
              onClick={handleRefresh}
              className="p-1.5 bg-surface-card hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
              title="Refresh Refrigerator Stock"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Threshold Settings Drawer (if toggled) */}
        {showThresholdSettings && (
          <div className="p-2.5 bg-surface-panel border-b border-border-subtle flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-150 flex-shrink-0">
            <div className="font-bold text-text-primary flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-brand-500" />
              <span>Aging Thresholds:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">Fresh:</span>
              <input
                type="number"
                min="1"
                max="15"
                value={freshMaxDays}
                onChange={e => setFreshMaxDays(Math.max(1, parseInt(e.target.value) || 2))}
                className="w-12 bg-surface-card border border-border-subtle rounded px-1.5 py-0.5 text-center font-mono font-bold text-text-primary text-xs"
              />
              <span className="text-text-muted">days (0-{freshMaxDays}d)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-rose-400 font-semibold">Needs Attention:</span>
              <input
                type="number"
                min={freshMaxDays + 1}
                max="30"
                value={warningMaxDays}
                onChange={e => setWarningMaxDays(Math.max(freshMaxDays + 1, parseInt(e.target.value) || 4))}
                className="w-12 bg-surface-card border border-border-subtle rounded px-1.5 py-0.5 text-center font-mono font-bold text-text-primary text-xs"
              />
              <span className="text-text-muted">days (&gt;{warningMaxDays}d)</span>
            </div>
          </div>
        )}

        {currentTab === 'stock' ? (
          /* Table Area (Fills remaining height with auto-scroll) */
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-12 text-center text-text-muted text-xs">Loading Refrigerator Stock...</div>
            ) : isError ? (
              <div className="p-12 text-center space-y-2 text-rose-400">
                <AlertTriangle size={32} className="mx-auto" />
                <div className="text-sm font-bold">Failed to load refrigerator stock</div>
                <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Unknown database error'}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Snowflake size={36} className="mx-auto text-text-muted/50" />
                <div className="text-sm font-bold text-text-secondary">No Refrigerator Stock Found</div>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Type any product code or name above, hit Enter, and press Space to move items into refrigerator inventory.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                  <tr>
                    <th className="py-2.5 px-4">PRODUCT / VARIANT</th>
                    <th className="py-2.5 px-4">CATEGORY</th>
                    <th className="py-2.5 px-4 text-right">CURRENT STOCK</th>
                    <th className="py-2.5 px-4 text-center">DAYS IN FRIDGE</th>
                    <th className="py-2.5 px-4 text-center">STATUS</th>
                    <th className="py-2.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredItems.map(item => {
                    const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual';
                    const unitLabel = isWeight ? 'kg' : 'pcs';
                    const daysInFridge = typeof item.days_in_fridge === 'number' && !isNaN(item.days_in_fridge) ? item.days_in_fridge : 0;
                    const qtyNum = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0;

                    return (
                      <tr key={item.product_variant_id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary">{item.product_name || 'Unnamed Product'}</div>
                          <div className="text-[10px] text-text-muted mt-0.5 font-mono">
                            {item.variant_name || 'Standard'} • {item.product_code || item.batch_number || item.oldest_batch_number || 'PROD'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{item.category || 'General'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                          {qtyNum.toFixed(isWeight ? 3 : 0)} <span className="text-xs font-normal text-text-muted">{unitLabel}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-text-secondary">
                          <div>{daysInFridge} day{daysInFridge !== 1 ? 's' : ''}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {daysInFridge > warningMaxDays ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                <AlertTriangle size={10} /> Needs Attention
                              </span>
                            ) : daysInFridge > freshMaxDays ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Clock size={10} /> Aging
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                                <ShieldCheck size={10} /> Fresh
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedItemForTakeOut(item)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                            title="Take out stock for kitchen prep or direct sale"
                          >
                            <LogOut size={12} />
                            <span>Take Out</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Refrigerator Movement Activity Log View */
          <div className="flex-1 overflow-y-auto">
            {isLoadingActivity ? (
              <div className="p-12 text-center text-text-muted text-xs">Loading activity records...</div>
            ) : activityLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <History size={32} className="mx-auto text-text-muted/50" />
                <div className="text-sm font-bold text-text-secondary">No Movement History Yet</div>
                <p className="text-xs text-text-muted">
                  Depositing, taking out, or billing stock directly from the refrigerator will log detailed records here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider z-10">
                    <th className="py-2.5 px-4">DATE & TIME</th>
                    <th className="py-2.5 px-3">PRODUCT</th>
                    <th className="py-2.5 px-3 text-center">MOVEMENT TYPE</th>
                    <th className="py-2.5 px-3 text-right">QUANTITY</th>
                    <th className="py-2.5 px-4">PURPOSE / REASON</th>
                    <th className="py-2.5 pr-4 text-right">RECORDED BY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-mono text-xs">
                  {activityLogs.map(log => {
                    const isWeight = log.unit_type === 'weight' || log.unit_type === 'live_dual';
                    const unitLabel = isWeight ? 'kg' : 'pcs';
                    const isDeposit = log.action_type === 'fridge_deposit' || (log.quantity_grams ?? 0) > 0 || (log.quantity_units ?? 0) > 0;
                    
                    const qtyDisplay = isWeight
                      ? `${Math.abs((log.quantity_grams || 0) / 1000).toFixed(3)} ${unitLabel}`
                      : `${Math.abs(log.quantity_units || 0)} ${unitLabel}`;

                    return (
                      <tr key={log.id} className="hover:bg-surface-hover/40 transition-colors">
                        <td className="py-2.5 px-4 text-text-secondary font-mono">
                          {log.created_at ? log.created_at.slice(0, 19).replace('T', ' ') : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-text-primary">{log.product_name}</div>
                          <div className="text-[10px] text-text-muted">{log.variant_name || 'Standard'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {isDeposit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                              <Plus size={10} />
                              <span>Put In (Deposit)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <LogOut size={10} />
                              <span>Take Out</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black">
                          <span className={isDeposit ? 'text-cyan-400' : 'text-rose-400'}>
                            {isDeposit ? '+' : '-'}{qtyDisplay}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-sans text-text-secondary text-xs">
                          {log.notes || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-sans text-text-muted text-xs">
                          {log.user_name || 'Admin'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Take Out Modal */}
      {selectedItemForTakeOut && (
        <FridgeTakeOutModal
          item={selectedItemForTakeOut}
          onClose={() => {
            setSelectedItemForTakeOut(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

export default function RefrigeratorStockView() {
  return (
    <ErrorBoundary fallbackTitle="Error loading Refrigerator Stock View">
      <RefrigeratorStockViewInner />
    </ErrorBoundary>
  );
}
