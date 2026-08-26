import { X, Clock, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatPaise } from '../../../billing/frontend/types/billing.types';
import type { AdminVariantRateHistory } from '../../types/products.types';

interface RateHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variantName: string;
  history: AdminVariantRateHistory[];
  isLoading: boolean;
}

export default function RateHistoryPanel({ isOpen, onClose, variantName, history, isLoading }: RateHistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-text-primary">Rate Change History</h2>
              <p className="text-[11px] text-text-muted">{variantName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-8">No rate history recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {history.map((entry, idx) => {
                const isLatest = idx === 0;
                const prevRate = entry.old_rate_paise_per_unit ?? (idx < history.length - 1 ? history[idx + 1].rate_paise_per_unit : null);
                const direction = prevRate !== null
                  ? entry.rate_paise_per_unit > prevRate ? 'up' : entry.rate_paise_per_unit < prevRate ? 'down' : 'same'
                  : 'initial';

                return (
                  <div key={entry.id || idx} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    isLatest ? 'bg-brand-500/5 border-brand-500/30 shadow-subtle' : 'bg-surface-card border-border-subtle'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        direction === 'up' ? 'bg-rose-500/15 text-rose-400' :
                        direction === 'down' ? 'bg-emerald-500/15 text-emerald-400' :
                        'bg-surface-panel text-text-muted'
                      }`}>
                        {direction === 'up' ? <TrendingUp size={16} /> :
                         direction === 'down' ? <TrendingDown size={16} /> :
                         <Clock size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-text-primary">
                          {prevRate !== null && prevRate !== entry.rate_paise_per_unit ? (
                            <>
                              <span className="text-text-muted line-through">{formatPaise(prevRate)}</span>
                              <ArrowRight size={12} className="text-text-muted" />
                              <span className={isLatest ? 'text-brand-500 font-extrabold text-sm' : 'text-text-primary'}>
                                {formatPaise(entry.rate_paise_per_unit)}
                              </span>
                            </>
                          ) : (
                            <span className={isLatest ? 'text-brand-500 font-extrabold text-sm' : 'text-text-primary'}>
                              {formatPaise(entry.rate_paise_per_unit)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {new Date(entry.effective_from).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {isLatest && (
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-brand-500/20 text-brand-500 rounded-full">
                          Current Rate
                        </span>
                      )}
                      <p className="text-[10px] text-text-muted font-semibold mt-1">
                        Changed by {entry.set_by_name || (entry.set_by === 1 ? 'Admin' : `User #${entry.set_by}`)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-text-muted text-center mt-4 border-t border-border-subtle/50 pt-3">
            Rate history is read-only. Past rates are strictly preserved as immutable audit records.
          </p>
        </div>
      </div>
    </div>
  );
}
