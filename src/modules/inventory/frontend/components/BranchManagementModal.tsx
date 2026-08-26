import React, { useState } from 'react';
import { X, Plus, Edit2, CheckCircle, XCircle, Building2, MapPin, Phone, AlertCircle, ShieldAlert } from 'lucide-react';
import { useBranches, useCreateBranch, useUpdateBranch, useToggleBranchActive, useDeleteBranch, Branch } from '../hooks/useBranches';

interface BranchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BranchManagementModal({ isOpen, onClose }: BranchManagementModalProps) {
  const { data: branches, isLoading, refetch } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const toggleActive = useToggleBranchActive();
  const deleteBranch = useDeleteBranch();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    is_default: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    setSelectedBranch(null);
    setFormData({
      code: '',
      name: '',
      address: '',
      phone: '',
      is_default: false,
    });
    setError(null);
    setSuccessMsg(null);
    setIsEditing(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      is_default: branch.is_default === 1,
    });
    setError(null);
    setSuccessMsg(null);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      if (selectedBranch) {
        await updateBranch.mutateAsync({
          id: selectedBranch.id,
          input: {
            code: formData.code,
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            is_default: formData.is_default,
          }
        });
        setSuccessMsg(`Branch "${formData.name}" updated successfully!`);
      } else {
        await createBranch.mutateAsync({
          code: formData.code,
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          is_default: formData.is_default,
        });
        setSuccessMsg(`Branch "${formData.name}" created successfully!`);
      }
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to save branch');
    }
  };

  const handleToggle = async (branch: Branch) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await toggleActive.mutateAsync({
        id: branch.id,
        isActive: branch.is_active !== 1
      });
      setSuccessMsg(`Branch status changed to ${branch.is_active === 1 ? 'Inactive' : 'Active'}`);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle branch status');
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!window.confirm(`Are you sure you want to delete branch "${branch.name}"?`)) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await deleteBranch.mutateAsync(branch.id);
      setSuccessMsg('Branch deleted successfully');
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to delete branch');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Branch & Outlet Management</h2>
              <p className="text-xs text-text-muted">Manage company store outlets, transfer hubs, and active locations.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus size={15} /> Add Branch
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="m-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto bg-surface-card/60 p-5 rounded-2xl border border-border-subtle">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Building2 size={16} className="text-brand-500" />
                {selectedBranch ? 'Edit Branch Details' : 'Register New Branch'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BR-MAIN, OUTLET-02"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Central Market Store"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Store Address</label>
                <textarea
                  rows={2}
                  placeholder="Physical street address, city, pin code..."
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Phone / Contact</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-primary">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                      className="rounded border-border-subtle text-brand-500 focus:ring-brand-500"
                    />
                    <span>Primary / Default Branch</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-xl border border-border-subtle text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBranch.isPending || updateBranch.isPending}
                  className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  {selectedBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-text-muted text-xs">Loading branches...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(branches || []).map(b => (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        b.is_active === 1
                          ? 'bg-surface-card/60 border-border-subtle hover:border-brand-500/40'
                          : 'bg-surface-card/20 border-border-subtle/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-text-primary">{b.name}</span>
                            {b.is_default === 1 && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-400 font-bold text-[10px] uppercase tracking-wider">
                                Default Primary
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                              b.is_active === 1 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                            }`}>
                              {b.is_active === 1 ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-text-muted">{b.code}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded-lg hover:bg-surface-panel text-text-muted hover:text-text-primary transition-colors"
                            title="Edit branch"
                          >
                            <Edit2 size={14} />
                          </button>
                          {b.is_default !== 1 && (
                            <>
                              <button
                                onClick={() => handleToggle(b)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  b.is_active === 1 ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={b.is_active === 1 ? 'Deactivate branch' : 'Activate branch'}
                              >
                                {b.is_active === 1 ? <XCircle size={14} /> : <CheckCircle size={14} />}
                              </button>
                              {!b.has_history && (
                                <button
                                  onClick={() => handleDelete(b)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                                  title="Delete branch"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-text-muted mt-3">
                        {b.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin size={13} className="shrink-0 mt-0.5 text-text-muted" />
                            <span className="line-clamp-1">{b.address}</span>
                          </div>
                        )}
                        {b.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={13} className="shrink-0 text-text-muted" />
                            <span>{b.phone}</span>
                          </div>
                        )}
                      </div>

                      {b.has_history && (
                        <div className="mt-3 pt-2.5 border-t border-border-subtle/50 flex items-center justify-between text-[11px] text-text-muted">
                          <span className="flex items-center gap-1 text-amber-400/80">
                            <ShieldAlert size={12} /> Transaction history protected (Deactivate only)
                          </span>
                          <span className="font-mono">{b.transfer_count || 0} Transfers</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
