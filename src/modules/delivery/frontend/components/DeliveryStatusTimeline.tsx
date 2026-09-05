// DeliveryStatusTimeline.tsx
// Visual state machine timeline and attempt history for Delivery orders

import React from 'react';
import { CheckCircle2, Clock, Truck, Package, UserCheck, AlertTriangle, XCircle, RotateCcw, Shield } from 'lucide-react';
import { DeliveryOrder, DeliveryStatus } from '../../types/delivery.types';

interface DeliveryStatusTimelineProps {
  delivery: DeliveryOrder;
  onUpdateStatus?: (status: DeliveryStatus, reason?: string) => void;
  onOpenAttemptModal?: () => void;
  isAdmin?: boolean;
}

const LINEAR_STAGES: Array<{ status: DeliveryStatus; label: string; icon: any }> = [
  { status: 'pending', label: 'Pending', icon: Clock },
  { status: 'preparing', label: 'Preparing', icon: Package },
  { status: 'ready_for_dispatch', label: 'Ready', icon: CheckCircle2 },
  { status: 'assigned', label: 'Assigned', icon: UserCheck },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export const DeliveryStatusTimeline: React.FC<DeliveryStatusTimelineProps> = ({
  delivery,
  onUpdateStatus,
  onOpenAttemptModal,
  isAdmin = true,
}) => {
  const currentStageIndex = LINEAR_STAGES.findIndex(s => s.status === delivery.status);
  const isFailed = delivery.status === 'failed';
  const isCancelled = delivery.status === 'cancelled';
  const isRescheduled = delivery.status === 'rescheduled';

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-5">
      {/* 1. Header with Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Lifecycle State</span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-base font-extrabold text-text-primary capitalize">{delivery.status.replace(/_/g, ' ')}</h3>
            {delivery.priority === 'urgent' && (
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                ⚡ Urgent
              </span>
            )}
          </div>
        </div>

        {/* OTP Code Badge */}
        {delivery.otp_code && (
          <div className="bg-surface-panel border border-border-subtle px-3 py-1.5 rounded-xl text-right">
            <span className="text-[9px] text-text-muted font-bold block">CONFIRMATION OTP</span>
            <span className="font-mono text-xs font-extrabold text-brand-500 tracking-wider">
              {delivery.otp_verified ? '✅ Verified' : `🔑 ${delivery.otp_code}`}
            </span>
          </div>
        )}
      </div>

      {/* 2. Visual Linear Step Bar */}
      {!isFailed && !isCancelled && (
        <div className="relative flex items-center justify-between py-2">
          {/* Connector Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-surface-panel rounded-full z-0">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{
                width: currentStageIndex >= 0 ? `${(currentStageIndex / (LINEAR_STAGES.length - 1)) * 100}%` : '0%'
              }}
            />
          </div>

          {LINEAR_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isCompleted = idx <= currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <div key={stage.status} className="relative z-10 flex flex-col items-center group">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? 'bg-brand-500 border-brand-300 text-white ring-4 ring-brand-500/20 shadow-lg scale-110'
                      : isCompleted
                      ? 'bg-brand-500/20 border-brand-500 text-brand-500'
                      : 'bg-surface-panel border-border-subtle text-text-muted'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span className={`text-[10px] mt-1.5 font-bold whitespace-nowrap ${
                  isCurrent ? 'text-brand-500 font-extrabold' : isCompleted ? 'text-text-primary' : 'text-text-muted'
                }`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Branch Alerts (Failed / Cancelled / Rescheduled) */}
      {(isFailed || isCancelled || isRescheduled) && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          isFailed ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          isCancelled ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400' :
          'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {isFailed && <AlertTriangle size={18} />}
            {isCancelled && <XCircle size={18} />}
            {isRescheduled && <RotateCcw size={18} />}
            <div>
              <p className="font-bold text-xs uppercase">{delivery.status}</p>
              <p className="text-[11px] opacity-80">
                {delivery.status_history?.[delivery.status_history.length - 1]?.reason || 'Delivery interrupted'}
              </p>
            </div>
          </div>

          {onUpdateStatus && (
            <button
              onClick={() => onUpdateStatus('pending', 'Rescheduled from exception')}
              className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover text-text-primary border border-border-subtle rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              Re-open / Reschedule
            </button>
          )}
        </div>
      )}

      {/* 3. Action Buttons for Next Transitions */}
      {onUpdateStatus && (
        <div className="pt-2 border-t border-border-subtle flex flex-wrap gap-2">
          {delivery.status === 'pending' && (
            <button
              onClick={() => onUpdateStatus('preparing')}
              className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              Start Preparing
            </button>
          )}

          {delivery.status === 'preparing' && (
            <button
              onClick={() => onUpdateStatus('ready_for_dispatch')}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
            >
              Ready for Dispatch
            </button>
          )}

          {delivery.status === 'ready_for_dispatch' && !delivery.driver_id && (
            <span className="text-xs text-amber-400 font-semibold self-center">
              ⚠️ Assign a driver to dispatch order
            </span>
          )}

          {delivery.driver_id && (delivery.status === 'assigned' || delivery.status === 'ready_for_dispatch') && (
            <button
              onClick={() => onUpdateStatus('out_for_delivery')}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all"
            >
              <Truck size={14} />
              <span>Dispatch (Out for Delivery)</span>
            </button>
          )}

          {delivery.status === 'out_for_delivery' && (
            <>
              <button
                onClick={() => onUpdateStatus('arrived')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
              >
                Driver Arrived
              </button>
              <button
                onClick={() => onUpdateStatus('delivered')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 size={14} />
                <span>Mark Delivered</span>
              </button>
              {onOpenAttemptModal && (
                <button
                  onClick={onOpenAttemptModal}
                  className="px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-hover text-red-400 border border-red-500/30 text-xs font-bold transition-all"
                >
                  Log Failed Attempt
                </button>
              )}
            </>
          )}

          {delivery.status === 'arrived' && (
            <button
              onClick={() => onUpdateStatus('delivered')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 size={14} />
              <span>Confirm Delivery</span>
            </button>
          )}

          {/* Cancel Order */}
          {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
            <button
              onClick={() => {
                const reason = prompt('Reason for cancellation:');
                if (reason) onUpdateStatus('cancelled', reason);
              }}
              className="ml-auto px-3 py-1.5 text-xs text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
            >
              Cancel Order
            </button>
          )}
        </div>
      )}

      {/* 4. Audit Trail History Accordion / List */}
      {delivery.status_history && delivery.status_history.length > 0 && (
        <div className="pt-3 border-t border-border-subtle space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Shield size={12} /> Status Transition History
          </span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {delivery.status_history.map((h, i) => (
              <div key={i} className="text-xs bg-surface-panel px-3 py-1.5 rounded-lg border border-border-subtle/50 flex items-center justify-between text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-primary capitalize">{h.to_status.replace(/_/g, ' ')}</span>
                  {h.reason && <span className="text-text-muted text-[11px]">— {h.reason}</span>}
                </div>
                <div className="text-[10px] text-text-muted font-mono flex items-center gap-2">
                  <span>{h.changed_by_name || 'System'}</span>
                  <span>{new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryStatusTimeline;
