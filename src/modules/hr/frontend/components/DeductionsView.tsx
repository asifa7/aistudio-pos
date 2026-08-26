import { useState, useMemo } from 'react';
import { 
  MinusCircle, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  ArrowUpRight, 
  UserCheck
} from 'lucide-react';
import { useDeductions, useCreateDeduction, useEmployees, useAdvances } from '../hooks/useHR';
import type { DeductionType } from '../../shared/hr.types';

const DEDUCTION_TYPES: DeductionType[] = [
  'Advance Recovery',
  'Unpaid Leave',
  'Loan Recovery',
  'Damage Deduction',
  'Employee Expense Recovery',
  'Other'
];

export default function DeductionsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState<number | 'ALL'>('ALL');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Queries
  const { data: rawDeductions = [], isLoading, isError, error, refetch } = useDeductions({
    employeeId: selectedEmpId !== 'ALL' ? selectedEmpId : undefined,
    deductionType: typeFilter !== 'ALL' ? typeFilter : undefined,
  });
  const deductions = useMemo(() => Array.isArray(rawDeductions) ? rawDeductions : [], [rawDeductions]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const { data: rawAdvances = [] } = useAdvances({ status: 'Active' });
  const activeAdvances = useMemo(() => Array.isArray(rawAdvances) ? rawAdvances : [], [rawAdvances]);

  const createDeductionMutation = useCreateDeduction();

  // Form State
  const [dedEmpId, setDedEmpId] = useState<number | ''>('');
  const [dedType, setDedType] = useState<DeductionType>('Other');
  const [dedAdvanceId, setDedAdvanceId] = useState<number | ''>('');
  const [dedAmount, setDedAmount] = useState('');
  const [dedDate, setDedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dedReason, setDedReason] = useState('');
  const [dedApprover, setDedApprover] = useState('Store Manager');
  const [dedError, setDedError] = useState<string | null>(null);

  // Advances belonging to selected employee
  const employeeAdvances = useMemo(() => {
    if (!dedEmpId) return [];
    return activeAdvances.filter(a => a.employee_id === Number(dedEmpId) && a.remaining_amount_paise > 0);
  }, [activeAdvances, dedEmpId]);

  const filteredDeductions = useMemo(() => {
    return deductions.filter(d => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = d.full_name?.toLowerCase().includes(q);
        const matchCode = d.emp_code?.toLowerCase().includes(q);
        const matchReason = d.reason?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    });
  }, [deductions, searchTerm]);

  // Totals
  const totalDeductionsPaise = useMemo(() => deductions.reduce((s, d) => s + (d.amount_paise || 0), 0), [deductions]);
  const advanceRecoveryPaise = useMemo(() => {
    return deductions.filter(d => d.deduction_type === 'Advance Recovery').reduce((s, d) => s + (d.amount_paise || 0), 0);
  }, [deductions]);
  const otherDeductionPaise = useMemo(() => {
    return deductions.filter(d => d.deduction_type !== 'Advance Recovery').reduce((s, d) => s + (d.amount_paise || 0), 0);
  }, [deductions]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDedError(null);

    if (!dedEmpId) {
      setDedError('Please select an employee.');
      return;
    }
    const amtNum = parseFloat(dedAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setDedError('Please enter a valid deduction amount.');
      return;
    }
    if (!dedReason.trim()) {
      setDedError('A reason is mandatory for all deductions.');
      return;
    }

    if (dedType === 'Advance Recovery') {
      if (!dedAdvanceId) {
        setDedError('Please select an active advance to recover against.');
        return;
      }
      const linkedAdv = employeeAdvances.find(a => a.id === Number(dedAdvanceId));
      if (linkedAdv && Math.round(amtNum * 100) > linkedAdv.remaining_amount_paise) {
        setDedError(`Amount exceeds remaining advance balance of ₹${(linkedAdv.remaining_amount_paise / 100).toFixed(2)}`);
        return;
      }
    }

    try {
      await createDeductionMutation.mutateAsync({
        employee_id: Number(dedEmpId),
        deduction_type: dedType,
        advance_id: dedType === 'Advance Recovery' && dedAdvanceId ? Number(dedAdvanceId) : null,
        amount_paise: Math.round(amtNum * 100),
        deduction_date: dedDate,
        reason: dedReason.trim(),
        approved_by_name: dedApprover.trim() || 'Store Manager',
      });

      setIsCreateModalOpen(false);
      setDedAmount('');
      setDedReason('');
      setDedAdvanceId('');
      refetch();
    } catch (err: any) {
      setDedError(err.message || 'Failed to record deduction.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-400">Total Deductions</span>
            <div className="text-base font-black text-rose-400 font-mono mt-0.5">
              -₹{(totalDeductionsPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <MinusCircle size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400">Advance Recoveries</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              ₹{(advanceRecoveryPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400">Other Deductions & Penalties</span>
            <div className="text-base font-black text-amber-400 font-mono mt-0.5">
              ₹{(otherDeductionPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search deductions by employee, reason..."
              className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 font-bold"
            />
          </div>

          <select
            value={selectedEmpId}
            onChange={e => setSelectedEmpId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Staff</option>
            {activeEmployees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code})</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Types</option>
            {DEDUCTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Record Deduction</span>
          </button>
        </div>
      </div>

      {/* Deductions Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading deduction records...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load deductions</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : filteredDeductions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <MinusCircle size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Deductions Recorded</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Record Deduction&quot; to log advance recoveries, damage deductions, or loan repayments.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">DATE & TYPE</th>
                  <th className="py-3 px-4">REASON</th>
                  <th className="py-3 px-4">APPROVED BY</th>
                  <th className="py-3 px-4 text-right text-rose-400 font-extrabold">AMOUNT (DEBIT)</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredDeductions.map(ded => {
                  return (
                    <tr key={ded.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-text-primary text-xs">{ded.full_name}</div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {ded.emp_code} • {ded.department}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-text-primary">{ded.deduction_date}</div>
                        <div className="text-[11px] font-bold text-rose-400 mt-0.5">
                          {ded.deduction_type}
                          {ded.advance_id && ` (Adv #${ded.advance_id})`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-text-secondary max-w-[240px] truncate" title={ded.reason}>
                        {ded.reason}
                      </td>

                      <td className="py-3.5 px-4 text-text-primary font-mono text-[11px] flex items-center gap-1 mt-1">
                        <UserCheck size={12} className="text-brand-500" />
                        <span>{ded.approved_by_name || 'Admin'}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 text-xs">
                        -₹{(ded.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle2 size={10} />
                          <span>Posted to Ledger</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Deduction Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <MinusCircle size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Record Salary Deduction</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Select Employee</label>
                <select
                  value={dedEmpId}
                  onChange={e => {
                    setDedEmpId(Number(e.target.value) || '');
                    setDedAdvanceId('');
                  }}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code} - {e.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Deduction Type</label>
                  <select
                    value={dedType}
                    onChange={e => setDedType(e.target.value as DeductionType)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    {DEDUCTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Deduction Date</label>
                  <input
                    type="date"
                    value={dedDate}
                    onChange={e => setDedDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              {/* If Advance Recovery, display active advances dropdown */}
              {dedType === 'Advance Recovery' && (
                <div>
                  <label className="font-bold text-text-secondary block mb-1">
                    Select Active Advance to Recover
                  </label>
                  {employeeAdvances.length > 0 ? (
                    <select
                      value={dedAdvanceId}
                      onChange={e => {
                        const val = Number(e.target.value) || '';
                        setDedAdvanceId(val);
                        const sel = employeeAdvances.find(a => a.id === val);
                        if (sel) setDedAmount(((sel.remaining_amount_paise || 0) / 100).toString());
                      }}
                      className="w-full bg-surface-card border border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none"
                      required
                    >
                      <option value="">-- Select Advance --</option>
                      {employeeAdvances.map(a => (
                        <option key={a.id} value={a.id}>
                          Ref #{a.id} ({a.advance_date}): ₹{(a.amount_paise / 100).toFixed(2)} [Remaining: ₹{(a.remaining_amount_paise / 100).toFixed(2)}]
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                      No active advances with outstanding balance found for this employee.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={dedAmount}
                    onChange={e => setDedAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-400 outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Approved By</label>
                  <input
                    type="text"
                    value={dedApprover}
                    onChange={e => setDedApprover(e.target.value)}
                    placeholder="e.g. Store Manager"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">
                  Reason <span className="text-rose-400">* (Mandatory)</span>
                </label>
                <textarea
                  rows={2}
                  value={dedReason}
                  onChange={e => setDedReason(e.target.value)}
                  placeholder="e.g. Recovery for advance paid on 5th Aug / Stock damage penalty"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {dedError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {dedError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeductionMutation.isPending}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-rose-500/20"
                >
                  {createDeductionMutation.isPending ? 'Recording...' : 'Post Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
