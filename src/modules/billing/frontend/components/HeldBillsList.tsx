import { Clock, Play, Trash2 } from 'lucide-react';
import { useHeldBills } from '../hooks/useHeldBills';
import { formatPaise } from '../types/billing.types';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface HeldBillsListProps {
  isOpen: boolean;
  onClose: () => void;
  onResume: (invoiceId: number) => void;
}

export default function HeldBillsList({ isOpen, onClose, onResume }: HeldBillsListProps) {
  const { data: heldBills, isLoading, refetch } = useHeldBills();

  if (!isOpen) return null;

  const handleDelete = async (invoiceId: number) => {
    await window.api.invoke(IPC_CHANNELS.BILLING.DELETE_DRAFT, { invoice_id: invoiceId });
    refetch();
  };

  const heldOnly = (heldBills || []).filter(b => b.status === 'held');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="bg-surface-card rounded-xl shadow-elevation border border-border-subtle w-[500px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-surface-panel px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            <div>
              <p className="text-text-primary font-bold text-sm">Parked / Held Bills</p>
              <p className="text-text-muted text-[10px]">{heldOnly.length} bill{heldOnly.length !== 1 ? 's' : ''} on hold</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs font-bold transition-colors">
            Close
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading && (
            <div className="text-center text-text-muted text-xs py-8">Loading held bills...</div>
          )}

          {!isLoading && heldOnly.length === 0 && (
            <div className="text-center text-text-muted text-xs py-8">
              No held bills at the moment
            </div>
          )}

          {heldOnly.map(bill => (
            <div
              key={bill.id}
              className="bg-surface-panel border border-border-subtle rounded-lg p-3 flex items-center justify-between hover:border-border-focus transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-text-primary">
                    Draft #{bill.id}
                  </span>
                  <span className="text-[9px] bg-amber-950/40 border border-amber-800/40 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                    {bill.status}
                  </span>
                  {bill.is_gst_invoice === 1 && (
                    <span className="text-[9px] bg-blue-950/40 border border-blue-800/40 text-blue-400 px-1.5 py-0.5 rounded font-bold">
                      GST
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted font-medium">
                  <span>Total: <strong className="text-brand-500 font-mono">{formatPaise(bill.total_paise)}</strong></span>
                  <span>Time: {new Date(bill.created_at).toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => handleDelete(bill.id)}
                  className="p-2 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-800/40 transition-colors"
                  title="Delete draft"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => { onResume(bill.id); onClose(); }}
                  className="btn-primary px-3 py-2 text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Play size={12} />
                  Resume
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
