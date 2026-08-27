import React, { useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck, X } from 'lucide-react';

interface ManagerOverrideModalProps {
  errorMessage: string;
  onCancel: () => void;
  onConfirm: (pin: string, reason: string) => void;
}

export default function ManagerOverrideModal({ errorMessage, onCancel, onConfirm }: ManagerOverrideModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('Bulk order');
  const [preAuth, setPreAuth] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(pin.trim(), reason.trim());
    if (preAuth) {
      sessionStorage.setItem('preAuthOverridePin', pin.trim());
      sessionStorage.setItem('preAuthOverrideReason', reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Solid Opaque Modal Container */}
      <div className="bg-surface-panel border border-border-subtle rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-text-primary">
        {/* Header with Warning */}
        <div className="p-4 bg-rose-500/15 border-b border-rose-500/20 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-black text-rose-400 text-base">Stock Shortage Override</h3>
              <p className="text-xs text-text-secondary mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onCancel}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-card transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-surface-card p-3 rounded-2xl border border-border-subtle flex gap-2.5 text-xs text-text-secondary">
            <Lock className="text-brand-500 shrink-0 mt-0.5" size={16} />
            <p>
              A Manager or Admin PIN is required to authorize selling more stock than physically available.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">
              Manager PIN / Password <span className="text-rose-400">*</span>
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-brand-500"
              placeholder="Enter PIN (e.g. 1234 / admin123)"
              autoFocus
            />
            <p className="text-[10px] text-text-muted">
              Accepts Manager/Admin password, PIN (1234 / admin123), or user code.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">
              Override Reason <span className="text-rose-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="Bulk order">Bulk order</option>
              <option value="Restock pending">Restock pending / Shipment incoming</option>
              <option value="Unrecorded fresh butchering">Unrecorded fresh butchering</option>
              <option value="Customer emergency">Customer emergency / Special request</option>
              <option value="Other">Other authorized reason</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input 
              type="checkbox" 
              id="preauth" 
              checked={preAuth}
              onChange={(e) => setPreAuth(e.target.checked)}
              className="w-4 h-4 rounded border-border-subtle text-brand-500 focus:ring-0 bg-surface-card cursor-pointer"
            />
            <label htmlFor="preauth" className="text-xs text-text-secondary cursor-pointer select-none">
              Pre-authorize overrides for the rest of this shift
            </label>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 btn-secondary py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              Cancel Sale
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              <ShieldCheck size={15} />
              <span>Authorize & Complete</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
