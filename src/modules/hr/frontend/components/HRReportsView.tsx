import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  RefreshCw, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownLeft
} from 'lucide-react';
import { usePayrollSummaryReport, useHRAuditLogs } from '../hooks/useHR';

export default function HRReportsView() {
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [reportTab, setReportTab] = useState<'payroll_summary' | 'audit_trail'>('payroll_summary');
  const [auditEntityFilter, setAuditEntityFilter] = useState('ALL');

  // Queries
  const { data: payrollSummary, refetch: refetchSummary } = usePayrollSummaryReport(selectedMonth);
  const { data: rawAuditLogs = [], isLoading: isAuditLoading, refetch: refetchAudit } = useHRAuditLogs({
    entityType: auditEntityFilter !== 'ALL' ? auditEntityFilter : undefined,
    limit: 100,
  });
  const auditLogs = useMemo(() => Array.isArray(rawAuditLogs) ? rawAuditLogs : [], [rawAuditLogs]);

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-panel p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setReportTab('payroll_summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportTab === 'payroll_summary'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <BarChart3 size={13} />
              <span>Payroll Summary Report</span>
            </button>

            <button
              onClick={() => setReportTab('audit_trail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportTab === 'audit_trail'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ShieldAlert size={13} />
              <span>HR Audit Trail</span>
            </button>
          </div>

          {reportTab === 'payroll_summary' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
            />
          )}

          {reportTab === 'audit_trail' && (
            <select
              value={auditEntityFilter}
              onChange={e => setAuditEntityFilter(e.target.value)}
              className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
            >
              <option value="ALL">All Entity Types</option>
              <option value="payroll_item">Payroll Overrides & Payments</option>
              <option value="payroll_run">Payroll Runs & Locks</option>
              <option value="advance">Advances</option>
              <option value="deduction">Deductions</option>
              <option value="expense">Expenses</option>
              <option value="attendance">Attendance</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchSummary();
              refetchAudit();
            }}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {reportTab === 'payroll_summary' ? (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-text-muted">Staff Headcount</span>
              <div className="text-lg font-black text-text-primary font-mono mt-0.5">
                {payrollSummary?.total_employees || 0} Employees
              </div>
              <p className="text-[9px] text-text-muted mt-0.5">
                {payrollSummary?.paid_count || 0} Paid • {payrollSummary?.unpaid_count || 0} Pending
              </p>
            </div>

            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Total Gross Salary</span>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                ₹{((payrollSummary?.total_gross_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[9px] text-text-muted mt-0.5">Basic + OT + Bonuses + Reimb.</p>
            </div>

            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-rose-400">Total Deductions</span>
              <div className="text-lg font-black text-rose-400 font-mono mt-0.5">
                -₹{((payrollSummary?.total_deductions_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[9px] text-text-muted mt-0.5">Advances + Unpaid Leave + Penalties</p>
            </div>

            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-cyan-400">Net Payroll Expenditure</span>
              <div className="text-lg font-black text-cyan-400 font-mono mt-0.5">
                ₹{((payrollSummary?.total_net_payout_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[9px] text-text-muted mt-0.5">Actual net shop cash flow</p>
            </div>
          </div>

          {/* Detailed Itemized Rollup Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Earnings Breakdown Card */}
            <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span>Gross Earnings Composition</span>
                <ArrowDownLeft size={14} />
              </h3>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Basic Salaries:</span>
                  <span className="font-bold text-text-primary">₹{((payrollSummary?.total_basic_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Fixed Allowances:</span>
                  <span className="font-bold text-text-primary">₹{((payrollSummary?.total_allowances_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Overtime (OT) Earnings:</span>
                  <span className="font-bold text-emerald-400">₹{((payrollSummary?.total_ot_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Incentives & Performance Bonuses:</span>
                  <span className="font-bold text-purple-400">₹{((payrollSummary?.total_incentives_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Staff Expense Reimbursements:</span>
                  <span className="font-bold text-cyan-400">₹{((payrollSummary?.total_reimbursements_paise || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Deductions Breakdown Card */}
            <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
                <span>Deductions & Recoveries Composition</span>
                <ArrowUpRight size={14} />
              </h3>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Advance Recoveries:</span>
                  <span className="font-bold text-rose-400">-₹{((payrollSummary?.total_advance_recoveries_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Unpaid Leave Deductions:</span>
                  <span className="font-bold text-rose-400">-₹{((payrollSummary?.total_unpaid_deductions_paise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-surface-panel">
                  <span className="text-text-secondary">Other Deductions & Penalties:</span>
                  <span className="font-bold text-rose-400">-₹{((payrollSummary?.total_other_deductions_paise || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Audit Trail Table */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
          {isAuditLoading ? (
            <div className="p-12 text-center text-text-muted text-xs">Loading audit records...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <ShieldAlert size={36} className="mx-auto text-text-muted/50" />
              <div className="text-sm font-bold text-text-secondary">No Audit Log Entries Found</div>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Modifications, salary overrides, payment reversals, and month locks will be permanently audited here.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                  <tr>
                    <th className="py-3 px-4">TIMESTAMP</th>
                    <th className="py-3 px-4">ENTITY</th>
                    <th className="py-3 px-4 text-center">ACTION</th>
                    <th className="py-3 px-4">REASON / DESCRIPTION</th>
                    <th className="py-3 px-4">PERFORMED BY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {auditLogs.map(log => {
                    return (
                      <tr key={log.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-text-primary text-[11px]">
                          {log.created_at}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-brand-400 font-bold">
                          {log.entity_type} #{log.entity_id}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.action === 'OVERRIDE' || log.action === 'REVERSE'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : log.action === 'LOCK'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}>
                            <span>{log.action}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-text-secondary max-w-[340px] truncate" title={log.reason}>
                          {log.reason}
                        </td>

                        <td className="py-3.5 px-4 text-text-primary font-mono text-[11px]">
                          {log.performed_by_name || 'Admin'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
