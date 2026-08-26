import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert } from 'lucide-react';

interface OverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newRatePaise: number, reason: string) => void;
  variantName: string;
  currentRatePaise: number;
}

export default function OverrideDialog({ isOpen, onClose, onConfirm, variantName, currentRatePaise }: OverrideDialogProps) {
  const [newRate, setNewRate] = useState('');
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewRate((currentRatePaise / 100).toFixed(2));
      setReason('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, currentRatePaise]);

  if (!isOpen) return null;

  const newRatePaise = Math.round(parseFloat(newRate || '0') * 100);
  const isValid = newRatePaise > 0 && reason.trim().length > 0;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(newRatePaise, reason.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onKeyDown={handleKeyDown}>
      <div className="bg-surface-card rounded-xl shadow-elevation border border-border-subtle w-[420px] overflow-hidden">
        {/* Header */}
        <div className="bg-surface-panel px-5 py-3.5 border-b border-border-subtle flex items-center gap-3">
          <ShieldAlert size={20} className="text-amber-400" />
          <div>
            <p className="text-text-primary font-bold text-sm">Price Override Required</p>
            <p className="text-text-muted text-[10px]">{variantName}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current Rate Display */}
          <div className="bg-surface-panel rounded-lg p-3 border border-border-subtle flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Current Rate</span>
            <span className="font-bold font-mono text-text-primary">
              ₹{(currentRatePaise / 100).toFixed(2)}
            </span>
          </div>

          {/* New Rate Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider">New Rate (₹)</label>
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-mono font-bold text-text-primary focus:border-brand-500 outline-none transition-all"
              placeholder="0.00"
            />
          </div>

          {/* Reason Input — MANDATORY */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider">
              Override Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full bg-surface-panel border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-medium text-text-primary focus:border-brand-500 outline-none transition-all resize-none"
              placeholder="e.g. Customer negotiation, bulk discount, loyalty adjustment..."
            />
            {reason.trim().length === 0 && (
              <p className="text-[10px] text-red-400 font-medium">Override reason is required for audit compliance</p>
            )}
          </div>

          {/* Rate Difference Badge */}
          {newRatePaise !== currentRatePaise && newRatePaise > 0 && (
            <div className={`text-xs font-bold px-3 py-2 rounded-lg text-center border ${
              newRatePaise < currentRatePaise
                ? 'bg-red-950/40 text-red-400 border-red-800/40'
                : 'bg-brand-500/10 text-brand-500 border-brand-500/50'
            }`}>
              {newRatePaise < currentRatePaise ? '↓' : '↑'} Rate change: ₹{((newRatePaise - currentRatePaise) / 100).toFixed(2)} per unit
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid}
              className="btn-primary flex-1 py-2.5 text-xs font-bold"
            >
              Apply Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
