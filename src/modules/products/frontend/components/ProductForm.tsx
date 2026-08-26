import { useState, useEffect, useMemo } from 'react';
import { X, Package, Plus, Check, AlertTriangle, Layers, History, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { FIXED_CATEGORIES } from '../../types/products.types';
import type { AdminProduct } from '../../types/products.types';
import { useCreateProduct, useUpdateProduct } from '../hooks/useProductMutations';
import { useAdminProducts } from '../hooks/useProducts';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: AdminProduct | null;
}

interface TrackingLog {
  id: number;
  product_id: number;
  old_track_in_inventory: number;
  new_track_in_inventory: number;
  reason: string;
  changed_by_name: string | null;
  created_at: string;
}

export default function ProductForm({ isOpen, onClose, editTarget }: ProductFormProps) {
  const isEdit = Boolean(editTarget);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: allProducts = [] } = useAdminProducts();

  // Dynamic available options from existing products + defaults
  const availableCategories = useMemo(() => {
    const set = new Set<string>(FIXED_CATEGORIES);
    allProducts.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [allProducts]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>(['Unprocessed (Raw)', 'Processed (Cut/Minced)', 'Ready to Cook', 'Offal / Special']);
    allProducts.forEach(p => {
      if (p.type && p.type.trim()) set.add(p.type.trim());
    });
    return Array.from(set);
  }, [allProducts]);

  const availableUnitTypes = useMemo(() => {
    const set = new Set<string>(['weight', 'piece', 'live_dual']);
    allProducts.forEach(p => {
      if (p.unit_type && p.unit_type.trim()) set.add(p.unit_type.trim());
    });
    return Array.from(set);
  }, [allProducts]);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(FIXED_CATEGORIES[0]);
  const [type, setType] = useState<string>('Unprocessed (Raw)');
  const [unitType, setUnitType] = useState<string>('weight');
  const [productCode, setProductCode] = useState<string>('');
  const [buyingRateRupees, setBuyingRateRupees] = useState<string>('');
  const [sellingRateRupees, setSellingRateRupees] = useState<string>('');
  const [trackInInventory, setTrackInInventory] = useState<boolean>(true);
  const [originalTrackInInventory, setOriginalTrackInInventory] = useState<boolean>(true);
  const [trackingChangeReason, setTrackingChangeReason] = useState<string>('');
  const [trackingLogs, setTrackingLogs] = useState<TrackingLog[]>([]);
  const [showTrackingHistory, setShowTrackingHistory] = useState(false);

  // Inline "Add New" state toggles
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [isAddingNewType, setIsAddingNewType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');

  const [isAddingNewUnitType, setIsAddingNewUnitType] = useState(false);
  const [newUnitTypeInput, setNewUnitTypeInput] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Auto-generate sequential product code on open for new products
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsAddingNewCategory(false);
      setNewCategoryInput('');
      setIsAddingNewType(false);
      setNewTypeInput('');
      setIsAddingNewUnitType(false);
      setNewUnitTypeInput('');
      setTrackingChangeReason('');
      setShowTrackingHistory(false);

      if (editTarget) {
        setName(editTarget.name);
        setCategory(editTarget.category || FIXED_CATEGORIES[0]);
        setType(editTarget.type || (editTarget.is_processed_cut === 1 ? 'Processed (Cut/Minced)' : 'Unprocessed (Raw)'));
        setUnitType(editTarget.unit_type || 'weight');
        setProductCode(editTarget.product_code || '');
        
        const currentCostPaise = editTarget.cost_price_paise_per_unit || editTarget.buying_rate_paise || editTarget.last_purchase_cost_paise || editTarget.variants?.[0]?.cost_price_paise_per_unit || 0;
        setBuyingRateRupees(currentCostPaise > 0 ? (currentCostPaise / 100).toString() : '');

        const currentRatePaise = editTarget.current_rate_paise_per_unit || editTarget.variants?.[0]?.current_rate_paise_per_unit || 0;
        setSellingRateRupees((currentRatePaise / 100).toString());

        const initialTrack = editTarget.track_in_inventory === 1 || editTarget.is_processed_cut === 0;
        setTrackInInventory(initialTrack);
        setOriginalTrackInInventory(initialTrack);

        // Fetch tracking audit log history
        window.api.invoke(IPC_CHANNELS.PRODUCTS.GET_TRACKING_HISTORY, { productId: editTarget.id })
          .then((res: any) => {
            if (res.success && Array.isArray(res.data)) {
              setTrackingLogs(res.data);
            }
          })
          .catch(err => console.error('Failed to fetch tracking history:', err));
      } else {
        setName('');
        setCategory(availableCategories[0] || 'Chicken');
        setType(availableTypes[0] || 'Unprocessed (Raw)');
        setUnitType('weight');
        setBuyingRateRupees('');
        setSellingRateRupees('');
        setTrackInInventory(true);
        setOriginalTrackInInventory(true);
        setTrackingLogs([]);

        // Compute next auto code: highest integer code + 1 (e.g. 1, 2, 3... or 9, 10...)
        let highestNum = 0;
        allProducts.forEach(p => {
          if (p.product_code) {
            const clean = p.product_code.replace(/^PRD-0*/, '');
            const num = parseInt(clean, 10);
            if (!isNaN(num) && num > highestNum) {
              highestNum = num;
            }
          }
        });
        const nextCode = String(highestNum > 0 ? highestNum + 1 : allProducts.length + 1);
        setProductCode(nextCode);
      }
    }
  }, [isOpen, editTarget, allProducts, availableCategories, availableTypes]);

  // Real-time Product Code Uniqueness Check
  const codeConflictProduct = useMemo(() => {
    const code = productCode.trim().toUpperCase();
    if (!code) return null;
    return allProducts.find(
      p => p.product_code?.toUpperCase() === code && (!isEdit || p.id !== editTarget?.id)
    );
  }, [productCode, allProducts, isEdit, editTarget]);

  if (!isOpen) return null;

  const isPending = createProduct.isPending || updateProduct.isPending;

  const handleAddNewCategory = () => {
    const val = newCategoryInput.trim();
    if (val) {
      setCategory(val);
      setIsAddingNewCategory(false);
      setNewCategoryInput('');
    }
  };

  const handleAddNewType = () => {
    const val = newTypeInput.trim();
    if (val) {
      setType(val);
      setIsAddingNewType(false);
      setNewTypeInput('');
    }
  };

  const handleAddNewUnitType = () => {
    const val = newUnitTypeInput.trim().toLowerCase();
    if (val) {
      setUnitType(val);
      setIsAddingNewUnitType(false);
      setNewUnitTypeInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product Name is required.');
      return;
    }

    const rateNum = parseFloat(sellingRateRupees);
    if (isNaN(rateNum) || rateNum <= 0) {
      setError('Please enter a valid Selling Rate (₹) greater than 0.');
      return;
    }

    const buyingNum = parseFloat(buyingRateRupees);
    const costPricePaise = !isNaN(buyingNum) && buyingNum > 0 ? Math.round(buyingNum * 100) : 0;

    const finalCode = productCode.trim();
    if (!finalCode) {
      setError('Product Code is required.');
      return;
    }

    if (codeConflictProduct) {
      setError(`This code is already used by "${codeConflictProduct.name}". Please choose a different code.`);
      return;
    }

    const ratePaise = Math.round(rateNum * 100);
    const isProcessed = type.toLowerCase().includes('process') ? 1 : 0;

    const isTrackingChanged = isEdit && editTarget && trackInInventory !== originalTrackInInventory;
    if (isTrackingChanged && !trackingChangeReason.trim()) {
      setError('Please provide a mandatory reason/note for changing the inventory tracking setting.');
      return;
    }

    try {
      if (isEdit && editTarget) {
        await updateProduct.mutateAsync({
          id: editTarget.id,
          fields: {
            name: trimmedName,
            category,
            type,
            unit_type: unitType,
            product_code: finalCode,
            rate_paise: ratePaise,
            cost_price_paise: costPricePaise,
            is_processed_cut: isProcessed,
            track_in_inventory: trackInInventory ? 1 : 0,
          },
        });

        // If tracking was changed, record audit entry
        if (isTrackingChanged) {
          await window.api.invoke(IPC_CHANNELS.PRODUCTS.UPDATE_TRACKING_MODE, {
            id: editTarget.id,
            trackInInventory,
            reason: trackingChangeReason.trim(),
          });
        }
      } else {
        await createProduct.mutateAsync({
          name: trimmedName,
          category,
          type,
          unit_type: unitType,
          product_code: finalCode,
          rate_paise: ratePaise,
          cost_price_paise: costPricePaise,
          is_processed_cut: isProcessed,
          track_in_inventory: trackInInventory ? 1 : 0,
        });
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save product');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-text-primary">
                {isEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-[11px] text-text-muted">
                {isEdit ? 'Update product details, rates & inventory tracking' : 'Create a sellable item in one simple form'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Product Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
              1. Product Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Live Broiler Chicken, Chicken Boneless, Mutton Curry Cut..."
              required
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-text-primary placeholder-text-muted outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              autoFocus
            />
          </div>

          {/* 2. Category Dropdown with inline "+ Add New Category" */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
                2. Category *
              </label>
              {!isAddingNewCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewCategory(true)}
                  className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1"
                >
                  <Plus size={12} /> Add New Category
                </button>
              )}
            </div>

            {isAddingNewCategory ? (
              <div className="flex gap-2 items-center bg-surface-card p-2 rounded-xl border border-brand-500/50">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={e => setNewCategoryInput(e.target.value)}
                  placeholder="Type new category name..."
                  className="flex-1 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors flex items-center gap-1"
                >
                  <Check size={12} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingNewCategory(false); setNewCategoryInput(''); }}
                  className="px-2 py-1.5 text-text-muted hover:text-text-primary text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Type Dropdown with inline "+ Add New Type" */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
                3. Type *
              </label>
              {!isAddingNewType && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewType(true)}
                  className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1"
                >
                  <Plus size={12} /> Add New Type
                </button>
              )}
            </div>

            {isAddingNewType ? (
              <div className="flex gap-2 items-center bg-surface-card p-2 rounded-xl border border-brand-500/50">
                <input
                  type="text"
                  value={newTypeInput}
                  onChange={e => setNewTypeInput(e.target.value)}
                  placeholder="Type new type classification..."
                  className="flex-1 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewType();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewType}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors flex items-center gap-1"
                >
                  <Check size={12} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingNewType(false); setNewTypeInput(''); }}
                  className="px-2 py-1.5 text-text-muted hover:text-text-primary text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* 4. Unit Type Dropdown with inline "+ Add New Unit Type" */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
                4. Unit Type *
              </label>
              {!isAddingNewUnitType && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewUnitType(true)}
                  className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1"
                >
                  <Plus size={12} /> Add New Unit Type
                </button>
              )}
            </div>

            {isAddingNewUnitType ? (
              <div className="flex gap-2 items-center bg-surface-card p-2 rounded-xl border border-brand-500/50">
                <input
                  type="text"
                  value={newUnitTypeInput}
                  onChange={e => setNewUnitTypeInput(e.target.value)}
                  placeholder="e.g. live_dual, carton, tray..."
                  className="flex-1 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500 font-mono"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewUnitType();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewUnitType}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors flex items-center gap-1"
                >
                  <Check size={12} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingNewUnitType(false); setNewUnitTypeInput(''); }}
                  className="px-2 py-1.5 text-text-muted hover:text-text-primary text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={unitType}
                onChange={e => setUnitType(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500 font-mono"
              >
                {availableUnitTypes.map(ut => (
                  <option key={ut} value={ut}>
                    {ut === 'weight' ? '⚖ Weight (kg / g)' : ut === 'piece' ? '🔢 Piece / Unit' : ut === 'live_dual' ? '🐔 Live Dual (Count + Weight)' : ut}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 5. Bill No. / Product Code */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>5. Bill No. / Item Code *</span>
              <span className="text-[10px] text-brand-500 font-semibold">Number typed on POS to bill</span>
            </label>
            <input
              type="text"
              value={productCode}
              onChange={e => setProductCode(e.target.value.toUpperCase())}
              placeholder="e.g. 1, 2, 101, etc."
              required
              className={`w-full bg-surface-card border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-text-primary placeholder-text-muted outline-none transition-colors ${
                codeConflictProduct ? 'border-rose-500 bg-rose-500/5 focus:border-rose-500' : 'border-border-subtle focus:border-brand-500'
              }`}
            />
            {codeConflictProduct && (
              <div className="flex items-center gap-1.5 text-rose-500 text-xs font-semibold mt-1">
                <AlertTriangle size={14} className="shrink-0" />
                <span>This code is already used by &ldquo;{codeConflictProduct.name}&rdquo;. Please choose a different code.</span>
              </div>
            )}
          </div>

          {/* Rates Row: Buying Rate BEFORE Selling Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 6. Buying Rate (₹) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>6. Buying Rate (₹)</span>
                <span className="text-[9px] text-text-muted font-normal">Purchase cost</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={buyingRateRupees}
                  onChange={e => setBuyingRateRupees(e.target.value)}
                  placeholder="e.g. 160.00"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3.5 py-2 text-xs font-mono font-bold text-text-primary placeholder-text-muted outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
              <p className="text-[9.5px] text-text-muted">
                Last purchase / opening cost basis.
              </p>
            </div>

            {/* 7. Selling Rate (₹) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>7. Selling Rate (₹) *</span>
                <span className="text-[9px] text-brand-500 font-bold">POS Price</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={sellingRateRupees}
                  onChange={e => setSellingRateRupees(e.target.value)}
                  placeholder="e.g. 240.00"
                  required
                  className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3.5 py-2 text-xs font-mono font-bold text-text-primary placeholder-text-muted outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
              <p className="text-[9.5px] text-text-muted">
                Per {unitType === 'weight' ? 'kg' : 'unit'}.
              </p>
            </div>
          </div>

          {/* 8. Track in Inventory Toggle */}
          <div className="p-3 bg-surface-card border border-border-subtle rounded-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <label htmlFor="chk-track-inventory" className="text-xs font-extrabold text-text-primary flex items-center gap-1.5 cursor-pointer">
                  <Layers size={13} className="text-brand-500" />
                  <span>Track in Inventory</span>
                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${trackInInventory ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-panel text-text-muted'}`}>
                    {trackInInventory ? 'ON' : 'OFF'}
                  </span>
                </label>
                <p className="text-[10px] text-text-muted">
                  Default is ON for inventory valuation and stock management.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="chk-track-inventory"
                  type="checkbox"
                  checked={trackInInventory}
                  onChange={e => setTrackInInventory(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
              </label>
            </div>

            {/* Mandatory Reason Box when toggle is changed on existing product */}
            {isEdit && trackInInventory !== originalTrackInInventory && (
              <div className="mt-1 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Changing Tracking Mode ({originalTrackInInventory ? 'ON ➔ OFF' : 'OFF ➔ ON'})</span>
                </div>
                <p className="text-[10.5px] text-amber-200/80 leading-relaxed">
                  {trackInInventory 
                    ? 'Switching tracking ON will resume ledger auditing and valuation calculations for this product.'
                    : 'Switching tracking OFF will bypass direct physical stock deduction limits for this product. Existing historical ledger records will be preserved.'}
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                    Reason for Change (Mandatory Audit Trail) *
                  </label>
                  <input
                    type="text"
                    value={trackingChangeReason}
                    onChange={e => setTrackingChangeReason(e.target.value)}
                    placeholder="e.g., Stock reconciliation / moving to non-tracked item..."
                    required
                    className="w-full bg-surface-panel border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Collapsible Tracking Change History */}
            {isEdit && trackingLogs.length > 0 && (
              <div className="mt-1 border-t border-border-subtle/60 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrackingHistory(!showTrackingHistory)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <History size={12} className="text-brand-500" />
                    <span>Tracking History ({trackingLogs.length} change{trackingLogs.length > 1 ? 's' : ''})</span>
                  </span>
                  {showTrackingHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showTrackingHistory && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {trackingLogs.map(log => (
                      <div key={log.id} className="p-2 bg-surface-panel rounded-lg border border-border-subtle text-[10.5px] space-y-0.5">
                        <div className="flex items-center justify-between font-semibold text-text-primary">
                          <span className="flex items-center gap-1">
                            <span className={log.new_track_in_inventory ? 'text-emerald-400' : 'text-rose-400'}>
                              {log.old_track_in_inventory ? 'Tracked' : 'Untracked'} ➔ {log.new_track_in_inventory ? 'Tracked' : 'Untracked'}
                            </span>
                          </span>
                          <span className="text-text-muted text-[9.5px] flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-text-secondary italic">&ldquo;{log.reason}&rdquo;</p>
                        <div className="text-[9px] text-text-muted flex items-center gap-1">
                          <User size={9} />
                          <span>By: {log.changed_by_name || 'Cashier'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs font-semibold text-rose-400">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-surface-card transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !sellingRateRupees.trim() || Boolean(codeConflictProduct)}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-brand-500/20"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
