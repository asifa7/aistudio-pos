import { useState, useEffect, useRef } from 'react';
import { QrCode, Search, UserPlus, X, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import CustomerSearch from '../../../customers/frontend/components/CustomerSearch';
import { useMatchUpiPayment, useConfirmUpiIdentity } from '../../../customers/frontend/hooks/useCustomers';
import type { Customer, UpiMatchCandidate } from '../../../customers/frontend/types/customer.types';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface UpiCustomerPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onSkipAndContinue: () => void;
  amountPaise: number;
  initialVpa?: string;
  initialPayerName?: string;
}

export default function UpiCustomerPromptModal({
  isOpen,
  onClose,
  onSelectCustomer,
  onSkipAndContinue,
  amountPaise,
  initialVpa = '',
  initialPayerName = '',
}: UpiCustomerPromptModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [vpa, setVpa] = useState(initialVpa);
  const [rememberVpa, setRememberVpa] = useState(true);

  const matchUpiMutation = useMatchUpiPayment();
  const confirmUpiMutation = useConfirmUpiIdentity();

  const [candidates, setCandidates] = useState<UpiMatchCandidate[]>([]);

  useEffect(() => {
    if (isOpen && (initialVpa || initialPayerName)) {
      matchUpiMutation.mutate(
        { vpa: initialVpa || null, payer_name: initialPayerName || null, amount_paise: amountPaise },
        {
          onSuccess: (res) => {
            if (res.candidates) {
              setCandidates(res.candidates);
            }
          },
        }
      );
    }
  }, [isOpen, initialVpa, initialPayerName, amountPaise]);

  // Global keydown: Escape skips, Enter confirms if customer chosen
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkipAndContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkipAndContinue]);

  if (!isOpen) return null;

  const handleConfirmSelected = async () => {
    if (!selectedCustomer) {
      onSkipAndContinue();
      return;
    }

    if (vpa.trim() && rememberVpa) {
      try {
        await confirmUpiMutation.mutateAsync({
          customer_id: selectedCustomer.id,
          vpa: vpa.trim(),
          payer_name: initialPayerName || selectedCustomer.name,
          auto_link: false,
        });
      } catch (err) {
        console.error('Failed to link UPI VPA identity', err);
      }
    }

    onSelectCustomer(selectedCustomer);
  };

  const handleCandidateChoose = (cand: UpiMatchCandidate) => {
    const cust: any = {
      id: cand.customer_id,
      customer_code: cand.customer_code,
      name: cand.name,
      phone: cand.phone,
      category: cand.category,
      customer_segment: cand.customer_segment,
      outstanding_balance_paise: 0,
      advance_balance_paise: 0,
      is_active: 1,
    };
    setSelectedCustomer(cust);
    if (cand.vpa) setVpa(cand.vpa);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
      <div className="bg-surface-panel border border-brand-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-subtle bg-surface-card/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-sm flex items-center gap-2">
                <span>Link UPI Sale to Customer?</span>
                <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 rounded-full text-[10px] font-mono">
                  {formatPaise(amountPaise)}
                </span>
              </h3>
              <p className="text-text-muted text-[11px] mt-0.5">
                Identify the customer to update their visit cadence & favorite cuts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkipAndContinue}
            className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary transition-colors"
            title="Skip & Print"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Smart Match Suggestions (if any candidates) */}
          {candidates.length > 0 && !selectedCustomer && (
            <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-300 dark:border-cyan-500/30 rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-cyan-800 dark:text-cyan-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> Suggested Customer Matches ({candidates.length})
                </span>
                <span className="text-[9px] text-text-muted">Requires Confirmation</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {candidates.map((cand) => (
                  <div
                    key={cand.customer_id}
                    onClick={() => handleCandidateChoose(cand)}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle hover:border-cyan-500/40 cursor-pointer transition-all shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-text-primary text-xs font-bold">{cand.name}</strong>
                        <span className="text-[10px] text-text-muted font-mono">({cand.customer_code})</span>
                        {cand.phone && <span className="text-[10px] text-text-secondary">📱 {cand.phone}</span>}
                      </div>
                      <p className="text-[10px] text-cyan-800 dark:text-cyan-300 mt-0.5 font-medium">{cand.match_reason}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40">
                        {cand.confidence_score}% match
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCandidateChoose(cand);
                        }}
                        className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fast Customer Search Box */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold text-text-muted">
              Search Customer by Phone, Name or Code:
            </label>
            <CustomerSearch
              value={selectedCustomer}
              onChange={(c) => setSelectedCustomer(c)}
              placeholder="Type phone digits (e.g. 9844) or name..."
            />
          </div>

          {/* VPA identity confirmation checkbox */}
          {selectedCustomer && (
            <div className="bg-surface-card border border-border-subtle rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary text-[11px]">Selected: {selectedCustomer.name}</span>
                <span className="text-[10px] text-text-muted font-mono">{selectedCustomer.customer_code}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember-vpa"
                  checked={rememberVpa}
                  onChange={(e) => setRememberVpa(e.target.checked)}
                  className="rounded border-border-subtle text-brand-500 focus:ring-0"
                />
                <label htmlFor="remember-vpa" className="text-[10px] text-text-secondary cursor-pointer select-none">
                  Remember this UPI identity for future automatic suggestions
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3.5 bg-surface-card/60 border-t border-border-subtle flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkipAndContinue}
            className="px-4 py-2 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-xl text-text-secondary hover:text-text-primary font-medium text-xs transition-colors flex items-center gap-1.5"
          >
            <span>Skip & Print</span>
            <span className="text-[10px] text-text-muted font-mono">(Esc)</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmSelected}
            disabled={!selectedCustomer}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-subtle flex items-center gap-2 transition-all"
          >
            <span>Link Customer & Print</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
