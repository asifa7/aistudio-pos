import { useState } from 'react';
import { 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard, 
  Gift, 
  Receipt, 
  DollarSign, 
  BookOpen, 
  Printer
} from 'lucide-react';
import { useEmployeeSummary360 } from '../hooks/useHR';
import type { PayrollItem } from '../types/hr.types';
import SalarySlipModal from './SalarySlipModal';

interface EmployeeDashboard360ModalProps {
  employeeId: number;
  onClose: () => void;
  onNavigateTab?: (tabKey: string) => void;
}

export default function EmployeeDashboard360Modal({ employeeId, onClose, onNavigateTab }: EmployeeDashboard360ModalProps) {
  const { data: summary, isLoading, isError, error } = useEmployeeSummary360(employeeId);
  const [selectedSlipItem, setSelectedSlipItem] = useState<PayrollItem | null>(null);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-surface-panel border border-border-subtle rounded-2xl p-8 text-center text-text-muted text-xs">
          Loading employee profile...
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-surface-panel border border-border-subtle rounded-2xl p-8 text-center text-rose-400 space-y-2">
          <div className="font-bold">Failed to load employee details</div>
          <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Not found'}</p>
          <button onClick={onClose} className="px-4 py-1.5 bg-surface-card rounded-xl text-xs font-bold text-text-primary">
            Close
          </button>
        </div>
      </div>
    );
  }

  const { employee, this_month, recent_payrolls, active_advances_count, total_advances_outstanding_paise, ledger_balance_paise } = summary;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-lg">
              {employee.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-text-primary">{employee.full_name}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-brand-500/15 text-brand-400 border border-brand-500/30 font-mono">
                  {employee.emp_code}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                  {employee.status}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {employee.role} • {employee.department} • Joined: {employee.joining_date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-xl hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Live Month Snapshot Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5 flex items-center justify-between">
              <span>This Month ({this_month.month_year}) Live Snapshot</span>
              <span className="text-[11px] text-brand-400 font-mono font-normal">Real-time dynamic rollup</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-surface-card border border-border-subtle">
                <span className="text-[10px] text-text-muted uppercase font-bold block">Worked Days</span>
                <span className="text-base font-black font-mono text-text-primary mt-0.5 block">
                  {this_month.worked_days} days
                </span>
                <p className="text-[9px] text-text-muted mt-0.5">{this_month.present_days} Pres • {this_month.absent_days} Abs • {this_month.paid_leave_days} Leave</p>
              </div>

              <div className="p-3 rounded-2xl bg-surface-card border border-border-subtle">
                <span className="text-[10px] text-text-muted uppercase font-bold block">Overtime Pay</span>
                <span className="text-base font-black font-mono text-brand-400 mt-0.5 block">
                  ₹{(this_month.overtime_amount_paise / 100).toFixed(2)}
                </span>
                <p className="text-[9px] text-text-muted mt-0.5">{this_month.overtime_hours} hrs logged</p>
              </div>

              <div className="p-3 rounded-2xl bg-surface-card border border-border-subtle">
                <span className="text-[10px] text-text-muted uppercase font-bold block">Active Advance Due</span>
                <span className="text-base font-black font-mono text-rose-400 mt-0.5 block">
                  ₹{(total_advances_outstanding_paise / 100).toFixed(2)}
                </span>
                <p className="text-[9px] text-text-muted mt-0.5">{active_advances_count} active advances</p>
              </div>

              <div className="p-3 rounded-2xl bg-surface-card border border-border-subtle">
                <span className="text-[10px] text-text-muted uppercase font-bold block">Est. Net Pay</span>
                <span className="text-base font-black font-mono text-emerald-400 mt-0.5 block">
                  ₹{(this_month.estimated_net_paise / 100).toFixed(2)}
                </span>
                <p className="text-[9px] text-text-muted mt-0.5">Bonus: ₹{(this_month.incentives_amount_paise / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Contact & Banking Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Contact & Identity</span>
              <div className="flex items-center gap-2 text-text-secondary"><Phone size={13} className="text-brand-500" /><span>{employee.mobile}</span></div>
              {employee.email && <div className="flex items-center gap-2 text-text-secondary"><Mail size={13} className="text-brand-500" /><span>{employee.email}</span></div>}
              {employee.address && <div className="flex items-center gap-2 text-text-secondary"><MapPin size={13} className="text-brand-500" /><span>{employee.address}</span></div>}
              <div className="pt-1 border-t border-border-subtle/50 flex justify-between font-mono text-[11px]">
                <span className="text-text-muted">Aadhaar:</span>
                <span className="font-bold text-text-primary">{employee.aadhaar_number || '—'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Bank & Ledger Position</span>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Bank Account:</span>
                <span className="font-mono font-bold text-text-primary">{employee.bank_account || '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">IFSC / UPI ID:</span>
                <span className="font-mono text-text-secondary">{employee.ifsc_code || employee.upi_id || '—'}</span>
              </div>
              <div className="pt-1 border-t border-border-subtle/50 flex justify-between items-center">
                <span className="text-text-muted">Master Ledger Balance:</span>
                <span className={`font-mono font-black text-xs ${ledger_balance_paise >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ledger_balance_paise >= 0 ? '+' : '-'}₹{(Math.abs(ledger_balance_paise) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Pills */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Quick Access</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Attendance', tab: 'attendance', icon: Clock },
                { label: 'Leaves', tab: 'leaves', icon: Calendar },
                { label: 'Advances', tab: 'advances', icon: CreditCard },
                { label: 'Expenses', tab: 'expenses', icon: Receipt },
                { label: 'Incentives', tab: 'incentives', icon: Gift },
                { label: 'Overtime', tab: 'overtime', icon: Clock },
                { label: 'Payroll', tab: 'payroll', icon: DollarSign },
                { label: 'Master Ledger', tab: 'ledger', icon: BookOpen },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.tab}
                    onClick={() => {
                      onClose();
                      onNavigateTab?.(action.tab);
                    }}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-bold text-text-primary transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Icon size={12} className="text-brand-500" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Payroll History */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Recent Payroll History</h3>
            {recent_payrolls.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle text-center text-text-muted text-xs">
                No past payroll records found for this employee.
              </div>
            ) : (
              <div className="rounded-2xl border border-border-subtle overflow-hidden bg-surface-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">MONTH</th>
                      <th className="py-2.5 px-3 text-center">DAYS WORKED</th>
                      <th className="py-2.5 px-3 text-right">GROSS EARNINGS</th>
                      <th className="py-2.5 px-3 text-right">DEDUCTIONS</th>
                      <th className="py-2.5 px-3 text-right text-emerald-400 font-extrabold">NET SALARY</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                      <th className="py-2.5 px-3 text-right">SLIP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-mono">
                    {recent_payrolls.map((pay: PayrollItem) => (
                      <tr key={pay.id} className="hover:bg-surface-hover/30">
                        <td className="py-2 px-3 font-bold text-text-primary">{pay.month_year}</td>
                        <td className="py-2 px-3 text-center text-text-muted">{pay.worked_days}d</td>
                        <td className="py-2 px-3 text-right text-text-primary">₹{(pay.gross_salary_paise / 100).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-rose-400">-₹{(pay.total_deductions_paise / 100).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-400">₹{(pay.net_salary_paise / 100).toFixed(2)}</td>
                        <td className="py-2 px-3 text-center font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pay.status === 'Paid' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          <button
                            onClick={() => setSelectedSlipItem(pay)}
                            className="p-1 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary"
                            title="View Salary Slip"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedSlipItem && (
        <SalarySlipModal
          item={selectedSlipItem}
          onClose={() => setSelectedSlipItem(null)}
        />
      )}
    </div>
  );
}
