// CODReconciliationModal.tsx
// Driver end-of-shift COD settlement and cash reconciliation modal

import React, { useState } from 'react';
import { DollarSign, Check, X, AlertTriangle, ShieldCheck, User } from 'lucide-react';
import { DeliveryDriver, DeliveryOrder } from '../../types/delivery.types';
import { useDeliveries, useReconcileDriverCOD } from '../hooks/useDelivery';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface CODReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DeliveryDriver;
}

export const CODReconciliationModal: React.FC<CODReconciliationModalProps> = ({
  isOpen,
  onClose,
  driver,
}) => {
  const { data: allDeliveries = [], isLoading } = useDeliveries({
    driverId: String(driver.id),
    status: 'delivered',
  });

  const reconcileMutation = useReconcileDriverCOD();
  const [notes, setNotes] = useState('');

  // Filter unreconciled COD deliveries
  const unreconciledDeliveries = allDeliveries.filter(
    d => d.payment_method === 'cod' && !d.cod_reconciled
  );

  let totalExpected = 0;
  let totalCollected = 0;

  unreconciledDeliveries.forEach(d => {
    totalExpected += (d.cod_expected_paise || d.total_paise);
    totalCollected += d.cod_collected_paise;
  });

  const totalVariance = totalCollected - totalExpected;

  const handleReconcile = async () => {
    if (unreconciledDeliveries.length === 0) {
      alert('No unreconciled COD deliveries found for this driver.');
      return;
    }

    try {
      await reconcileMutation.mutateAsync({
        driverId: driver.id,
        notes: notes || undefined,
      });
      alert(`COD settlement for driver ${driver.name} completed successfully.`);
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to reconcile driver COD');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-app border border-border-subtle rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-border-subtle bg-surface-panel flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-primary">Driver COD Shift Settlement</h3>
              <p className="text-xs text-text-muted">Driver: <span className="font-semibold text-text-primary">{driver.name}</span> ({driver.vehicle_number || driver.phone})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-panel border border-border-subtle p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-text-muted">Expected COD</span>
              <p className="text-sm font-extrabold font-mono text-text-primary mt-0.5">{formatPaise(totalExpected)}</p>
              <span className="text-[10px] text-text-muted">{unreconciledDeliveries.length} delivered orders</span>
            </div>

            <div className="bg-surface-panel border border-border-subtle p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-text-muted">Collected Cash</span>
              <p className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5">{formatPaise(totalCollected)}</p>
              <span className="text-[10px] text-text-muted">Physical Handover</span>
            </div>

            <div className={`p-3 rounded-xl border ${
              totalVariance === 0 ? 'bg-surface-panel border-border-subtle' :
              totalVariance > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <span className="text-[10px] uppercase font-bold opacity-80">Shift Variance</span>
              <p className="text-sm font-extrabold font-mono mt-0.5">
                {totalVariance > 0 ? `+${formatPaise(totalVariance)}` : formatPaise(totalVariance)}
              </p>
              <span className="text-[10px]">
                {totalVariance === 0 ? '🟢 Exact Match' : totalVariance > 0 ? 'Surplus Cash' : '🔴 Shortage Detected'}
              </span>
            </div>
          </div>

          {/* List of Orders */}
          <div className="space-y-2">
            <label className="font-bold text-[10px] uppercase tracking-wider text-text-muted">
              Unsettled Shift Deliveries
            </label>

            {unreconciledDeliveries.length === 0 ? (
              <div className="p-4 text-center bg-surface-card border border-border-subtle rounded-xl text-text-muted">
                All delivered COD orders for this driver are already reconciled.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {unreconciledDeliveries.map(d => (
                  <div key={d.id} className="p-2.5 bg-surface-card border border-border-subtle rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary font-mono">{d.delivery_number}</span>
                        <span className="text-text-muted">· {d.customer_name}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Delivered at {d.delivered_at ? new Date(d.delivered_at).toLocaleTimeString() : 'Recently'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-text-primary">{formatPaise(d.cod_collected_paise || d.total_paise)}</div>
                      {d.cod_variance_paise !== 0 && (
                        <span className="text-[10px] text-red-400 font-bold font-mono">
                          Variance: {formatPaise(d.cod_variance_paise)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-bold text-[10px] uppercase tracking-wider text-text-muted">Settlement Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Verified by Cashier / Drawer deposit complete"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 text-xs"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle bg-surface-panel flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-semibold text-text-secondary hover:bg-surface-hover"
          >
            Close
          </button>

          <button
            type="button"
            disabled={unreconciledDeliveries.length === 0 || reconcileMutation.isPending}
            onClick={handleReconcile}
            className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Complete COD Settlement ({formatPaise(totalCollected)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CODReconciliationModal;
