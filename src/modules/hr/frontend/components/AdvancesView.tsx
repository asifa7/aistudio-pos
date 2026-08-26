import { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  RefreshCw, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet,
  Building2,
  QrCode
} from 'lucide-react';
import { useAdvances, useCreateAdvance, useEmployees, useCreateDeduction } from '../hooks/useHR';
import type { EmployeeAdvance } from '../../shared/hr.types';

export default function AdvancesView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Partially_Recovered' | 'Fully_Recovered'>('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState<number | 'ALL'>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [recoveringAdvance, setRecoveringAdvance] = useState<EmployeeAdvance | null>(null);

  // Queries
  const { data: rawAdvances = [], isLoading, isError, error, refetch } = useAdvances({
    employeeId: selectedEmpId !== 'ALL' ? selectedEmpId : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });
  const advances = useMemo(() => Array.isArray(rawAdvances) ? rawAdvances : [], [rawAdvances]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const createAdvanceMutation = useCreateAdvance();
  const createDeductionMutation = useCreateDeduction();

  // Create Advance Form State
  const [advEmpId, setAdvEmpId] = useState<number | ''>('');
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [advPaymentMode, setAdvPaymentMode] = useState<'cash' | 'bank' | 'upi'>('cash');
  const [advReason, setAdvReason] = useState('');
  const [advError, setAdvError] = useState<string | null>(null);

  // Recovery Form State
  const [recAmount, setRecAmount] = useState('');
  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recReason, setRecReason] = useState('Monthly Salary Advance Deduction');
  const [recApprover, setRecApprover] = useState('Store Manager');
  const [recError, setRecError] = useState<string | null>(null);

  const filteredAdvances = useMemo(() => {
    return advances.filter(a => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = a.full_name?.toLowerCase().includes(q);
        const matchCode = a.emp_code?.toLowerCase().includes(q);
        const matchReason = a.reason?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    });
  }, [advances, searchTerm]);

  // Metric Totals
  const totalGivenPaise = useMemo(() => advances.reduce((s, a) => s + (a.amount_paise || 0), 0), [advances]);
  const totalRecoveredPaise = useMemo(() => advances.reduce((s, a) => s + (a.recovered_amount_paise || 0), 0), [advances]);
  const totalRemainingPaise = useMemo(() => advances.reduce((s, a) => s + (a.remaining_amount_paise || 0), 0), [advances]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvError(null);

    if (!advEmpId) {
      setAdvError('Please select an employee.');
      return;
    }
    const amtNum = parseFloat(advAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setAdvError('Please enter a valid advance amount.');
      return;
    }
    if (!advReason.trim()) {
      setAdvError('Please specify the reason for this advance.');
      return;
    }

    try {
      await createAdvanceMutation.mutateAsync({
        employee_id: Number(advEmpId),
        amount_paise: Math.round(amtNum * 100),
        advance_date: advDate,
        payment_mode: advPaymentMode,
        reason: advReason.trim(),
      });

      setIsCreateModalOpen(false);
      setAdvAmount('');
      setAdvReason('');
      refetch();
    } catch (err: any) {
      setAdvError(err.message || 'Failed to issue advance.');
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);

    if (!recoveringAdvance) return;
    const amtNum = parseFloat(recAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setRecError('Please enter a valid recovery amount.');
      return;
    }

    const amtPaise = Math.round(amtNum * 100);
    if (amtPaise > recoveringAdvance.remaining_amount_paise) {
      setRecError(`Amount exceeds remaining advance balance of ₹${(recoveringAdvance.remaining_amount_paise / 100).toFixed(2)}`);
      return;
    }

    try {
      await createDeductionMutation.mutateAsync({
        employee_id: recoveringAdvance.employee_id,
        deduction_type: 'Advance Recovery',
        advance_id: recoveringAdvance.id,
        amount_paise: amtPaise,
        deduction_date: recDate,
        reason: recReason.trim() || 'Advance Recovery Deduction',
        approved_by_name: recApprover.trim() || 'Store Manager',
      });

      setRecoveringAdvance(null);
      setRecAmount('');
      refetch();
    } catch (err: any) {
      setRecError(err.message || 'Failed to record advance recovery.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Advances Given</span>
            <div className="text-base font-black text-text-primary font-mono mt-0.5">
              ₹{(totalGivenPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Recovered</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              ₹{(totalRecoveredPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Outstanding Balance</span>
            <div className="text-base font-black text-rose-400 font-mono mt-0.5">
              ₹{(totalRemainingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <Wallet size={18} />
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
              placeholder="Search advances by employee name, code, reason..."
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
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active (Pending Recovery)</option>
            <option value="Partially_Recovered">Partially Recovered</option>
            <option value="Fully_Recovered">Fully Recovered (₹0)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
            title="Refresh Advances"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Issue Advance</span>
          </button>
        </div>
      </div>

      {/* Cash Box & Single Source Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-amber-300 flex-shrink-0">
        <span>
          <strong>Single Source of Truth:</strong> Recording cash advances automatically writes a <strong>Cash-Out</strong> entry to Cash Box and posts a <strong>Debit</strong> in the Employee Ledger. Remaining balance is derived dynamically from recorded recoveries.
        </span>
      </div>

      {/* Advances Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading advances...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load advances</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : filteredAdvances.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CreditCard size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Advances Found</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Issue Advance&quot; above to disburse salary advances to staff.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">DATE & REASON</th>
                  <th className="py-3 px-4 text-center">PAY MODE</th>
                  <th className="py-3 px-4 text-right">ADVANCE AMOUNT</th>
                  <th className="py-3 px-4 text-right text-emerald-400">RECOVERED</th>
                  <th className="py-3 px-4 text-right text-rose-400 font-extrabold">REMAINING</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredAdvances.map(adv => {
                  const isFullyRecovered = adv.remaining_amount_paise === 0;

                  return (
                    <tr key={adv.id} className="hover:bg-surface-hover/30 transition-colors">
                      {/* Employee */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-text-primary text-xs">{adv.full_name}</div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {adv.emp_code} • {adv.department}
                        </div>
                      </td>

                      {/* Date & Reason */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-text-primary">{adv.advance_date}</div>
                        <div className="text-[11px] text-text-secondary mt-0.5 max-w-[200px] truncate" title={adv.reason}>
                          {adv.reason}
                        </div>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-surface-panel border border-border-subtle text-text-primary font-mono">
                          {adv.payment_mode === 'cash' && <Wallet size={10} className="text-amber-400" />}
                          {adv.payment_mode === 'bank' && <Building2 size={10} className="text-cyan-400" />}
                          {adv.payment_mode === 'upi' && <QrCode size={10} className="text-emerald-400" />}
                          <span>{adv.payment_mode}</span>
                        </span>
                      </td>

                      {/* Advance Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                        ₹{(adv.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Recovered Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        ₹{(adv.recovered_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Remaining Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 text-xs">
                        ₹{(adv.remaining_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isFullyRecovered
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : adv.recovered_amount_paise > 0
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isFullyRecovered ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          <span>{isFullyRecovered ? 'Fully Recovered' : adv.recovered_amount_paise > 0 ? 'Partially Recovered' : 'Active (Unpaid)'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {!isFullyRecovered ? (
                          <button
                            onClick={() => {
                              setRecoveringAdvance(adv);
                              setRecAmount(((adv.remaining_amount_paise || 0) / 100).toString());
                            }}
                            className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                            title="Record Advance Recovery Deduction"
                          >
                            <span>Recover ₹</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-text-muted">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Advance Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <DollarSign size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Issue Salary Advance</h3>
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
                  value={advEmpId}
                  onChange={e => setAdvEmpId(Number(e.target.value) || '')}
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
                  <label className="font-bold text-text-secondary block mb-1">Advance Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={advAmount}
                    onChange={e => setAdvAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Payment Mode</label>
                  <select
                    value={advPaymentMode}
                    onChange={e => setAdvPaymentMode(e.target.value as any)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="cash">Cash (Auto Cash-Out)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Date</label>
                <input
                  type="date"
                  value={advDate}
                  onChange={e => setAdvDate(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Reason / Purpose</label>
                <textarea
                  rows={2}
                  value={advReason}
                  onChange={e => setAdvReason(e.target.value)}
                  placeholder="e.g. Emergency family medical expense"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {advError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {advError}
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
                  disabled={createAdvanceMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {createAdvanceMutation.isPending ? 'Disbursing...' : 'Confirm Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Advance Recovery Modal */}
      {recoveringAdvance && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary">Record Advance Recovery</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {recoveringAdvance.full_name} ({recoveringAdvance.emp_code}) • Ref #{recoveringAdvance.id}
                </p>
              </div>
              <button
                onClick={() => setRecoveringAdvance(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-surface-card border border-border-subtle space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Original Advance:</span>
                <span className="font-bold text-text-primary">₹{(recoveringAdvance.amount_paise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Already Recovered:</span>
                <span className="font-bold text-emerald-400">₹{(recoveringAdvance.recovered_amount_paise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border-subtle/50 pt-1">
                <span className="text-text-muted">Remaining To Recover:</span>
                <span className="font-black text-rose-400">₹{(recoveringAdvance.remaining_amount_paise / 100).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleRecoverySubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Recovery Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={(recoveringAdvance.remaining_amount_paise / 100)}
                    step="any"
                    value={recAmount}
                    onChange={e => setRecAmount(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Recovery Date</label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={e => setRecDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Deduction Reason</label>
                <input
                  type="text"
                  value={recReason}
                  onChange={e => setRecReason(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Approved By</label>
                <input
                  type="text"
                  value={recApprover}
                  onChange={e => setRecApprover(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              {recError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {recError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecoveringAdvance(null)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeductionMutation.isPending}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20"
                >
                  {createDeductionMutation.isPending ? 'Processing...' : 'Record Recovery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
