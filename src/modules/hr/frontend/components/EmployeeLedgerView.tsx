import { useState, useMemo } from 'react';
import { 
  BookOpen, 
  RefreshCw, 
  DollarSign, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Receipt, 
  Gift, 
  Clock, 
  MinusCircle
} from 'lucide-react';
import { useEmployeeLedger, useEmployees } from '../hooks/useHR';
import type { LedgerEntryType } from '../../shared/hr.types';

const ENTRY_TYPE_CONFIG: Record<LedgerEntryType, { label: string; icon: any; colorClass: string; bgClass: string }> = {
  advance: { label: 'Advance Given', icon: CreditCard, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  advance_disbursement: { label: 'Advance Given', icon: CreditCard, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  advance_recovery: { label: 'Advance Recovery', icon: ArrowDownLeft, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expense_claim: { label: 'Expense Claim (+)', icon: Receipt, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expense_reimbursement: { label: 'Reimbursement (+)', icon: Receipt, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  expense_deduction: { label: 'Expense Deduction (-)', icon: Receipt, colorClass: 'text-rose-400', bgClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  company_expense: { label: 'Company Expense (Ref)', icon: Receipt, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  incentive: { label: 'Incentive / Bonus (+)', icon: Gift, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  overtime: { label: 'Overtime Pay (+)', icon: Clock, colorClass: 'text-blue-400', bgClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  deduction: { label: 'Salary Deduction (-)', icon: MinusCircle, colorClass: 'text-rose-400', bgClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  salary_credit: { label: 'Salary Earned (+)', icon: DollarSign, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  salary_payout: { label: 'Salary Paid Out (-)', icon: DollarSign, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
};

export default function EmployeeLedgerView() {
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: rawEmployees = [] } = useEmployees({ includeInactive: true });
  const employees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  // Set default employee if unset
  useMemo(() => {
    if (selectedEmpId === null && employees.length > 0) {
      setSelectedEmpId(employees[0].id);
    }
  }, [employees, selectedEmpId]);

  const { data: rawLedger = [], isLoading, isError, error, refetch } = useEmployeeLedger(
    selectedEmpId,
    startDate || endDate ? { start: startDate || undefined, end: endDate || undefined } : undefined
  );
  const ledger = useMemo(() => Array.isArray(rawLedger) ? rawLedger : [], [rawLedger]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Totals
  const totalDebitPaise = useMemo(() => ledger.reduce((s, r) => s + (r.debit_paise || 0), 0), [ledger]);
  const totalCreditPaise = useMemo(() => ledger.reduce((s, r) => s + (r.credit_paise || 0), 0), [ledger]);
  const netBalancePaise = useMemo(() => {
    if (ledger.length === 0) return 0;
    return ledger[ledger.length - 1].running_balance_paise;
  }, [ledger]);

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Filter & Employee Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[300px]">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-500" />
            <span className="text-xs font-bold text-text-secondary">Employee:</span>
          </div>

          <select
            value={selectedEmpId || ''}
            onChange={e => setSelectedEmpId(Number(e.target.value) || null)}
            className="flex-1 max-w-xs bg-surface-panel border border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none"
          >
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.emp_code} - {e.role}) {e.is_active !== 1 ? '[Inactive]' : ''}
              </option>
            ))}
          </select>

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 bg-surface-panel border border-border-subtle rounded-xl p-1">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-mono text-text-primary px-2 py-1 outline-none"
              placeholder="From Date"
            />
            <span className="text-text-muted text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-mono text-text-primary px-2 py-1 outline-none"
              placeholder="To Date"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      {selectedEmployee && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
          <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-400">Total Debits (Deductions / Advances)</span>
              <div className="text-base font-black text-rose-400 font-mono mt-0.5">
                -₹{(totalDebitPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <ArrowUpRight size={18} />
            </div>
          </div>

          <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400">Total Credits (OT / Incentives / Reimb.)</span>
              <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                +₹{(totalCreditPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ArrowDownLeft size={18} />
            </div>
          </div>

          <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400">Running Net Balance</span>
              <div className={`text-base font-black font-mono mt-0.5 ${
                (netBalancePaise ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(netBalancePaise ?? 0) >= 0 ? '+' : '-'}₹{(Math.abs(netBalancePaise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[9px] text-text-muted mt-0.5">
                {(netBalancePaise ?? 0) >= 0 ? 'Shop owes employee' : 'Employee owes shop'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <BookOpen size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Ledger Statement Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading ledger statement...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load ledger records</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : ledger.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <BookOpen size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Ledger Transactions Found</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Transactions from advances, reimbursements, incentives, overtime, and deductions will appear in this ledger.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">REF NUMBER</th>
                  <th className="py-3 px-4 text-center">TYPE</th>
                  <th className="py-3 px-4">TRANSACTION DESCRIPTION</th>
                  <th className="py-3 px-4 text-right text-rose-400 font-extrabold">DEBIT (₹)</th>
                  <th className="py-3 px-4 text-right text-emerald-400 font-extrabold">CREDIT (₹)</th>
                  <th className="py-3 px-4 text-right font-extrabold">RUNNING BALANCE (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {ledger.map(row => {
                  const cfg = ENTRY_TYPE_CONFIG[row.entry_type] || {
                    label: row.entry_type,
                    icon: DollarSign,
                    colorClass: 'text-text-primary',
                    bgClass: 'bg-surface-panel text-text-primary border-border-subtle',
                  };
                  const Icon = cfg.icon;
                  const runningBalance = row.running_balance_paise ?? row.balance_paise ?? 0;
                  const isPositiveBalance = runningBalance >= 0;

                  return (
                    <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-text-primary">
                        {row.entry_date}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-brand-400 font-bold text-[11px]">
                        {row.reference_number || `TXN-${row.id}`}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.bgClass}`}>
                          <Icon size={10} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-text-secondary max-w-[280px] truncate" title={row.description || undefined}>
                        {row.description}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400">
                        {row.debit_paise > 0 ? `-₹${(row.debit_paise / 100).toFixed(2)}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {row.credit_paise > 0 ? `+₹${(row.credit_paise / 100).toFixed(2)}` : '—'}
                      </td>

                      <td className={`py-3.5 px-4 text-right font-mono font-black text-xs ${
                        isPositiveBalance ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isPositiveBalance ? '+' : '-'}₹{(Math.abs(runningBalance) / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
