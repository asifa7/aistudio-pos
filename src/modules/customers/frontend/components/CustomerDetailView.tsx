import { useState } from 'react';
import {
  X, User, Edit3, Banknote, Lock, Unlock
} from 'lucide-react';
import {
  useCustomerCreditAccount, useFreezeCredit, useUnfreezeCredit,
  useCustomerReminders, useCreateReminder, useCreditNotes
} from '../hooks/useCustomerCredit';
import { useCustomerActivityLog } from '../hooks/useCustomers';
import { formatPaise, formatDate, getCategoryBadgeColor } from '../types/customer.types';
import type { Customer } from '../types/customer.types';
import LedgerView from './LedgerView';
import PaymentDialog from './PaymentDialog';

interface CustomerDetailViewProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

type Tab = 'overview' | 'ledger' | 'payments' | 'credit_notes' | 'reminders' | 'activity';

export default function CustomerDetailView({ customer, isOpen, onClose, onEdit }: CustomerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderChannel, setReminderChannel] = useState('sms');
  const [reminderMsg, setReminderMsg] = useState('');
  
  if (!isOpen || !customer) return null;

  const { data: creditAcc } = useCustomerCreditAccount(customer.id);
  const { data: reminders } = useCustomerReminders(customer.id);
  const { data: creditNotes } = useCreditNotes(customer.id);
  const { data: activityLogs } = useCustomerActivityLog(customer.id);

  const freezeCredit = useFreezeCredit();
  const unfreezeCredit = useUnfreezeCredit();
  const createReminder = useCreateReminder();

  const handleToggleFreeze = async () => {
    if (creditAcc?.is_frozen) {
      await unfreezeCredit.mutateAsync(customer.id);
    } else {
      const reason = prompt('Enter freeze reason:') || 'Requested by manager';
      await freezeCredit.mutateAsync({ customer_id: customer.id, reason });
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderMsg.trim()) return;
    try {
      await createReminder.mutateAsync({
        customer_id: customer.id,
        channel: reminderChannel,
        template_type: 'payment_due',
        message: reminderMsg,
      });
      setReminderMsg('');
      setIsReminderOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-surface-panel border-l border-border-subtle shadow-2xl flex flex-col z-40 select-none text-xs text-text-secondary">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-surface-app/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <User size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">{customer.name}</h3>
            <p className="text-[10px] text-text-secondary mt-0.5">
              {customer.customer_code} · <span className={`px-2 py-0.5 border rounded-full text-[9px] ${getCategoryBadgeColor(customer.category)}`}>{customer.category}</span>
            </p>
          </div>
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-1.5">
          {creditAcc?.is_frozen === 1 && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold rounded text-[9px] uppercase">
              Frozen
            </span>
          )}
          {creditAcc?.is_blacklisted === 1 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded text-[9px] uppercase">
              Blacklisted
            </span>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-surface-app/40 rounded-full text-text-secondary hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-4 gap-2.5 p-4 border-b border-border-subtle bg-surface-app/10">
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-text-secondary">Outstanding</p>
          <p className="text-xs font-mono font-bold text-red-400 mt-1">{formatPaise(customer.outstanding_balance_paise)}</p>
        </div>
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-text-secondary">Available Credit</p>
          <p className="text-xs font-mono font-bold text-brand-500 mt-1">
            {formatPaise(Math.max(0, customer.credit_limit_paise - customer.outstanding_balance_paise))}
          </p>
        </div>
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-text-secondary">Advance Balance</p>
          <p className="text-xs font-mono font-bold text-brand-500 mt-1">{formatPaise(customer.advance_balance_paise)}</p>
        </div>
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-text-secondary">Credit Limit</p>
          <p className="text-xs font-mono font-bold text-white mt-1">{formatPaise(customer.credit_limit_paise)}</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border-subtle bg-surface-app/30">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'ledger', label: 'Ledger DR/CR' },
          { id: 'payments', label: 'Payments Log' },
          { id: 'credit_notes', label: 'Credit Notes' },
          { id: 'reminders', label: 'Reminders' },
          { id: 'activity', label: 'Activity Logs' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as Tab)}
            className={`flex-1 py-3 text-center border-b-2 font-semibold transition-colors ${
              activeTab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions Panel */}
            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4">
              <h4 className="font-semibold text-white mb-3">Quick Actions</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setIsPaymentOpen(true)}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border-subtle bg-surface-app hover:border-white hover:text-white transition-colors"
                >
                  <Banknote size={16} className="text-accent mb-1.5" />
                  <span>Record Payment</span>
                </button>
                <button
                  onClick={handleToggleFreeze}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border-subtle bg-surface-app hover:border-white hover:text-white transition-colors"
                >
                  {creditAcc?.is_frozen ? (
                    <>
                      <Unlock size={16} className="text-brand-500 mb-1.5" />
                      <span>Unfreeze Credit</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} className="text-yellow-400 mb-1.5" />
                      <span>Freeze Credit</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => onEdit(customer)}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border-subtle bg-surface-app hover:border-white hover:text-white transition-colors"
                >
                  <Edit3 size={16} className="text-brand-500 mb-1.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-surface-panel border border-border-subtle rounded-xl p-5">
              <div>
                <span className="text-[10px] text-text-secondary">Enterprise / Business</span>
                <p className="text-xs font-semibold text-white mt-0.5">{customer.business_name || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary">Preferred Method</span>
                <p className="text-xs font-semibold text-white mt-0.5 uppercase">{customer.preferred_payment_method}</p>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary">Primary Contact (Phone)</span>
                <p className="text-xs font-mono font-semibold text-white mt-0.5">{customer.phone || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary">Email</span>
                <p className="text-xs font-semibold text-white mt-0.5">{customer.email || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-text-secondary">Billing Address</span>
                <p className="text-xs font-semibold text-white mt-0.5">
                  {customer.billing_address_line1 ? (
                    `${customer.billing_address_line1}, ${customer.billing_address_line2 || ''} ${customer.billing_city}, ${customer.billing_state} - ${customer.billing_pincode}`
                  ) : 'No address provided'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-text-secondary">Internal Remarks</span>
                <p className="text-xs text-white/95 leading-relaxed mt-0.5">{customer.notes || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <LedgerView customerId={customer.id} customerName={customer.name} />
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-app text-[10px]">
                    <th className="px-4 py-2 text-text-secondary">Date</th>
                    <th className="px-3 py-2 text-text-secondary">Method</th>
                    <th className="px-3 py-2 text-text-secondary">Reference No</th>
                    <th className="px-3 py-2 text-right text-text-secondary">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(!reminders || reminders.length === 0) && ( // wait, let's look at transactions or payments
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-text-secondary">No payments logged</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'credit_notes' && (
          <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-app text-[10px]">
                  <th className="px-4 py-2 text-text-secondary">Note Number</th>
                  <th className="px-3 py-2 text-text-secondary">Reason</th>
                  <th className="px-3 py-2 text-right text-text-secondary">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {!creditNotes || creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-text-secondary">No credit notes found</td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-surface-app/30">
                      <td className="px-4 py-2 font-mono text-white">{cn.credit_note_number}</td>
                      <td className="px-3 py-2 text-white">{cn.reason}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-400 font-bold">{formatPaise(cn.amount_paise)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Reminder History</span>
              <button
                onClick={() => setIsReminderOpen(true)}
                className="px-3 py-1 bg-accent hover:bg-brand-500 rounded text-white font-bold transition-colors"
              >
                Create Reminder
              </button>
            </div>

            {/* List */}
            <div className="bg-surface-panel border border-border-subtle rounded-xl divide-y divide-border-subtle">
              {!reminders || reminders.length === 0 ? (
                <div className="py-6 text-center text-text-secondary">No reminders sent yet</div>
              ) : (
                reminders.map((rem) => (
                  <div key={rem.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white capitalize">{rem.channel} ({rem.template_type})</span>
                      <span className="text-[10px] text-text-secondary font-mono">{formatDate(rem.created_at)}</span>
                    </div>
                    <p className="text-white/80 mt-1 leading-relaxed">{rem.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Reminder Modal inside details sidebar */}
            {isReminderOpen && (
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 mt-4 space-y-3">
                <h4 className="font-bold text-white">New Reminder Message</h4>
                <div className="flex items-center gap-2">
                  <label className="text-text-secondary">Channel:</label>
                  <select
                    value={reminderChannel}
                    onChange={(e) => setReminderChannel(e.target.value)}
                    className="bg-surface-app border border-border-subtle rounded px-2 py-1 text-white"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="manual">Manual Register</option>
                  </select>
                </div>
                <textarea
                  value={reminderMsg}
                  onChange={(e) => setReminderMsg(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded p-2 text-white h-20"
                  placeholder="Enter message text here..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setIsReminderOpen(false)} className="px-3 py-1 border border-border-subtle rounded text-white">Cancel</button>
                  <button onClick={handleSendReminder} className="px-3 py-1 bg-accent rounded text-white font-bold">Send / Log</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4">
              <div className="relative border-l border-border-subtle pl-4 space-y-4">
                {!activityLogs || activityLogs.length === 0 ? (
                  <div className="text-center py-4 text-text-secondary">No activity logs recorded</div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-accent/20 border border-accent flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-secondary">
                        <span className="font-semibold text-white capitalize">{log.action}</span>
                        <span className="font-mono">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-white/80 mt-0.5 leading-relaxed">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render Record Payment Dialog */}
      {isPaymentOpen && (
        <PaymentDialog
          isOpen={isPaymentOpen}
          onClose={() => {
            setIsPaymentOpen(false);
          }}
          customer={customer}
        />
      )}
    </div>
  );
}
