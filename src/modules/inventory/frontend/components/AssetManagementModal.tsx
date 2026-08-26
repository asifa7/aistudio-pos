import React, { useState, useEffect } from 'react';
import { X, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { useCreateAsset, useUpdateAsset, AssetItem } from '../hooks/useAssets';
import { useActiveBranches } from '../hooks/useBranches';

interface AssetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: AssetItem | null;
}

const CATEGORIES = [
  'Refrigeration',
  'Lighting',
  'Furniture',
  'Equipment',
  'Weighing Scales',
  'Cutlery & Knives',
  'Other'
];

export default function AssetManagementModal({ isOpen, onClose, assetToEdit }: AssetManagementModalProps) {
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const { data: branches } = useActiveBranches();

  const [formData, setFormData] = useState({
    name: '',
    category: 'Refrigeration',
    purchase_cost_rupees: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    status: 'active',
    branch_id: 1,
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        name: assetToEdit.name,
        category: assetToEdit.category,
        purchase_cost_rupees: String((assetToEdit.purchase_cost_paise / 100).toFixed(2)),
        purchase_date: assetToEdit.purchase_date.slice(0, 10),
        status: assetToEdit.status,
        branch_id: assetToEdit.branch_id || 1,
        notes: assetToEdit.notes || '',
      });
    } else {
      setFormData({
        name: '',
        category: 'Refrigeration',
        purchase_cost_rupees: '',
        purchase_date: new Date().toISOString().slice(0, 10),
        status: 'active',
        branch_id: branches?.[0]?.id || 1,
        notes: '',
      });
    }
    setError(null);
    setSuccess(null);
  }, [assetToEdit, isOpen, branches]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const costNum = parseFloat(formData.purchase_cost_rupees);
    if (isNaN(costNum) || costNum < 0) {
      setError('Please enter a valid purchase cost');
      return;
    }

    try {
      if (assetToEdit) {
        await updateAsset.mutateAsync({
          id: assetToEdit.id,
          input: {
            name: formData.name,
            category: formData.category,
            purchase_cost_paise: Math.round(costNum * 100),
            purchase_date: formData.purchase_date,
            status: formData.status,
            branch_id: formData.branch_id,
            notes: formData.notes,
          }
        });
        setSuccess('Asset updated successfully!');
      } else {
        await createAsset.mutateAsync({
          name: formData.name,
          category: formData.category,
          purchase_cost_paise: Math.round(costNum * 100),
          purchase_date: formData.purchase_date,
          status: formData.status,
          branch_id: formData.branch_id,
          notes: formData.notes,
        });
        setSuccess('Asset added successfully!');
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save asset');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Package size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">
                {assetToEdit ? 'Edit Asset' : 'Add Physical Shop Asset'}
              </h2>
              <p className="text-xs text-text-muted">Track store equipment, valuation, and replacement cycle.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Asset Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Deep Freezer 400L, Electronic Weighing Scale"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Branch / Location</label>
              <select
                value={formData.branch_id}
                onChange={e => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              >
                {(branches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Purchase Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="₹ 0.00"
                value={formData.purchase_cost_rupees}
                onChange={e => setFormData({ ...formData, purchase_cost_rupees: e.target.value })}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Purchase Date *</label>
              <input
                type="date"
                required
                value={formData.purchase_date}
                onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Current Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              >
                <option value="active">Active (In Use)</option>
                <option value="damaged">Damaged / Needs Repair</option>
                <option value="replaced">Replaced</option>
                <option value="disposed">Disposed / Scrapped</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Notes / Specifications</label>
            <textarea
              rows={2}
              placeholder="Model number, warranty info, vendor..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border-subtle text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAsset.isPending || updateAsset.isPending}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              {assetToEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
