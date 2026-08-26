import { useState, useMemo } from 'react';
import { 
  Calendar, 
  Plus, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  RefreshCw
} from 'lucide-react';
import { 
  useLeaveTypes, 
  useLeaves, 
  useApplyLeave, 
  useApproveLeave, 
  useLeaveBalances, 
  useCreateLeaveType,
  useEmployees 
} from '../hooks/useHR';

export default function LeaveManagementView() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeSubView, setActiveSubView] = useState<'requests' | 'balances'>('requests');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isNewTypeModalOpen, setIsNewTypeModalOpen] = useState(false);

  // Queries
  const { data: rawLeaveTypes = [], refetch: refetchTypes } = useLeaveTypes();
  const leaveTypes = useMemo(() => Array.isArray(rawLeaveTypes) ? rawLeaveTypes : [], [rawLeaveTypes]);

  const { data: rawLeaves = [], isLoading, isError, error, refetch: refetchLeaves } = useLeaves({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    year: selectedYear,
  });
  const leaves = useMemo(() => Array.isArray(rawLeaves) ? rawLeaves : [], [rawLeaves]);

  const { data: rawBalances = [], refetch: refetchBalances } = useLeaveBalances(undefined, selectedYear);
  const balances = useMemo(() => Array.isArray(rawBalances) ? rawBalances : [], [rawBalances]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const approveMutation = useApproveLeave();
  const applyMutation = useApplyLeave();
  const createTypeMutation = useCreateLeaveType();

  // Apply Leave Form State
  const [applyEmpId, setApplyEmpId] = useState<number | ''>('');
  const [applyTypeId, setApplyTypeId] = useState<number | ''>('');
  const [applyStartDate, setApplyStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [applyEndDate, setApplyEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [applyReason, setApplyReason] = useState('');
  const [applyIsPaid, setApplyIsPaid] = useState<boolean>(true);
  const [applyError, setApplyError] = useState<string | null>(null);

  // New Leave Type Form State
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeDays, setNewTypeDays] = useState('12');
  const [newTypePaid, setNewTypePaid] = useState(true);
  const [typeError, setTypeError] = useState<string | null>(null);

  const pendingCount = leaves.filter(l => l.status === 'Pending').length;

  const handleApproveReject = async (leaveId: number, status: 'Approved' | 'Rejected') => {
    let reason: string | undefined;
    if (status === 'Rejected') {
      const input = prompt('Please enter reason for rejection (optional):');
      if (input === null) return;
      reason = input || 'Rejected by Admin';
    }

    try {
      await approveMutation.mutateAsync({ leave_id: leaveId, status, rejection_reason: reason });
      refetchLeaves();
      refetchBalances();
    } catch (err: any) {
      alert(err.message || 'Failed to update leave request.');
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);

    if (!applyEmpId) {
      setApplyError('Please select an employee.');
      return;
    }
    if (!applyTypeId) {
      setApplyError('Please select a leave type.');
      return;
    }

    const selectedLt = leaveTypes.find(lt => lt.id === Number(applyTypeId));
    const leaveTypeName = selectedLt ? selectedLt.name : 'Casual Leave';

    try {
      await applyMutation.mutateAsync({
        employee_id: Number(applyEmpId),
        leave_type_id: Number(applyTypeId),
        leave_type: leaveTypeName,
        start_date: applyStartDate,
        end_date: applyEndDate,
        reason: applyReason.trim() || 'Leave Request',
        is_paid: applyIsPaid,
      });

      setIsApplyModalOpen(false);
      setApplyReason('');
      refetchLeaves();
      refetchBalances();
    } catch (err: any) {
      setApplyError(err.message || 'Failed to submit leave request.');
    }
  };

  const handleCreateTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeError(null);

    if (!newTypeName.trim()) {
      setTypeError('Please enter leave type name.');
      return;
    }
    if (!newTypeCode.trim()) {
      setTypeError('Please enter a short code (e.g. CL, SL).');
      return;
    }

    const daysNum = parseInt(newTypeDays, 10) || 0;

    try {
      await createTypeMutation.mutateAsync({
        name: newTypeName.trim(),
        code: newTypeCode.trim().toUpperCase(),
        default_days_per_year: daysNum,
        is_paid: newTypePaid,
      });

      setIsNewTypeModalOpen(false);
      setNewTypeName('');
      setNewTypeCode('');
      refetchTypes();
      refetchBalances();
    } catch (err: any) {
      setTypeError(err.message || 'Failed to create leave type.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Filter & Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Sub-view switcher tabs */}
          <div className="flex items-center bg-surface-panel p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setActiveSubView('requests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubView === 'requests'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Calendar size={13} />
              <span>Leave Requests</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubView('balances')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubView === 'balances'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Layers size={13} />
              <span>Leave Balances ({selectedYear})</span>
            </button>
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>

          {/* Status Filter (when on requests view) */}
          {activeSubView === 'requests' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
            >
              <option value="ALL">All Requests ({leaves.length})</option>
              <option value="Pending">Pending Approvals ({pendingCount})</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchLeaves();
              refetchBalances();
              refetchTypes();
            }}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
            title="Refresh Leave Data"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsNewTypeModalOpen(true)}
            className="px-3 py-2 bg-surface-panel hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Plus size={13} />
            <span>Leave Types</span>
          </button>

          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Apply Leave</span>
          </button>
        </div>
      </div>

      {/* Auto-Sync Informational Notice */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-emerald-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-400 flex-shrink-0" />
          <span>
            <strong>Automatic Attendance Sync:</strong> Approving any leave request immediately populates the matching days in the <strong>Daily Attendance Grid</strong> (Paid / Unpaid Leave).
          </span>
        </div>
      </div>

      {/* Content Area */}
      {activeSubView === 'requests' ? (
        /* Leave Requests Table */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted text-xs">Loading leave requests...</div>
          ) : isError ? (
            <div className="p-12 text-center space-y-2 text-rose-400">
              <AlertCircle size={32} className="mx-auto" />
              <div className="text-sm font-bold">Failed to load leave records</div>
              <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Calendar size={36} className="mx-auto text-text-muted/50" />
              <div className="text-sm font-bold text-text-secondary">No Leave Requests</div>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Click &quot;Apply Leave&quot; to log staff leave requests.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                  <tr>
                    <th className="py-3 px-4">EMPLOYEE</th>
                    <th className="py-3 px-4">LEAVE TYPE</th>
                    <th className="py-3 px-4">DATES & DURATION</th>
                    <th className="py-3 px-4">REASON</th>
                    <th className="py-3 px-4 text-center">PAY TYPE</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {leaves.map(l => {
                    const isPending = l.status === 'Pending';
                    const isApproved = l.status === 'Approved';
                    const isRejected = l.status === 'Rejected';

                    return (
                      <tr key={l.id} className="hover:bg-surface-hover/30 transition-colors">
                        {/* Employee */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-bold text-text-primary text-xs">{l.full_name}</div>
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            {l.emp_code} • {l.department}
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="py-3.5 px-4 font-bold text-text-primary">
                          {l.leave_type}
                        </td>

                        {/* Date Range & Total Days */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-text-primary">
                            {l.start_date} → {l.end_date}
                          </div>
                          <div className="text-[10px] text-brand-400 font-bold mt-0.5">
                            {l.total_days} day{l.total_days !== 1 ? 's' : ''}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 text-text-secondary max-w-[220px] truncate" title={l.reason}>
                          {l.reason || '—'}
                          {l.rejection_reason && (
                            <div className="text-[10px] text-rose-400 mt-0.5 truncate">
                              Reject note: {l.rejection_reason}
                            </div>
                          )}
                        </td>

                        {/* Paid/Unpaid */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.is_paid 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          }`}>
                            {l.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isApproved
                              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                              : isRejected
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {isApproved && <CheckCircle2 size={11} />}
                            {isRejected && <XCircle size={11} />}
                            {isPending && <Clock size={11} />}
                            <span>{l.status}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveReject(l.id, 'Approved')}
                                className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                title="Approve Leave & Auto-Mark Attendance"
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleApproveReject(l.id, 'Rejected')}
                                className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                title="Reject Leave Request"
                              >
                                <X size={12} />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-muted">
                              {l.approved_by_name ? `By ${l.approved_by_name}` : 'Processed'}
                            </span>
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
      ) : (
        /* Leave Balances Matrix Table */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">LEAVE TYPE</th>
                  <th className="py-3 px-4 text-center">TYPE NATURE</th>
                  <th className="py-3 px-4 text-right">ALLOCATED / YR</th>
                  <th className="py-3 px-4 text-right">APPROVED / USED</th>
                  <th className="py-3 px-4 text-right text-emerald-400 font-extrabold">REMAINING BALANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {balances.map((b, idx) => (
                  <tr key={`${b.employee_id}-${b.leave_type_id}-${idx}`} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-text-primary text-xs">{b.full_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{b.emp_code}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-text-primary">
                      {b.leave_type_name} <span className="font-mono text-text-muted text-[10px]">({b.leave_type_code})</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.is_paid 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                      }`}>
                        {b.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                      {b.allocated_days} days
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {b.used_days} days
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-xs">
                      {b.remaining_days} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
                  <Calendar size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Apply Leave Request</h3>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Select Employee</label>
                <select
                  value={applyEmpId}
                  onChange={e => setApplyEmpId(Number(e.target.value) || '')}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.emp_code} - {e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Leave Type</label>
                  <select
                    value={applyTypeId}
                    onChange={e => {
                      const val = Number(e.target.value) || '';
                      setApplyTypeId(val);
                      const lt = leaveTypes.find(t => t.id === val);
                      if (lt) setApplyIsPaid(Boolean(lt.is_paid));
                    }}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">-- Choose Type --</option>
                    {leaveTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Compensation Nature</label>
                  <select
                    value={applyIsPaid ? '1' : '0'}
                    onChange={e => setApplyIsPaid(e.target.value === '1')}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="1">Paid Leave</option>
                    <option value="0">Unpaid Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={applyStartDate}
                    onChange={e => setApplyStartDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">End Date</label>
                  <input
                    type="date"
                    value={applyEndDate}
                    onChange={e => setApplyEndDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={applyReason}
                  onChange={e => setApplyReason(e.target.value)}
                  placeholder="e.g. Family function / Medical illness"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {applyError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {applyMutation.isPending ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Leave Type Modal */}
      {isNewTypeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-black text-text-primary">Configure Leave Types</h3>
              <button
                onClick={() => setIsNewTypeModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of existing leave types */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {leaveTypes.map(lt => (
                <div key={lt.id} className="flex items-center justify-between p-2 rounded-xl bg-surface-card border border-border-subtle text-xs">
                  <div>
                    <span className="font-bold text-text-primary">{lt.name}</span>
                    <span className="font-mono text-[10px] text-text-muted ml-1.5">({lt.code})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted font-mono">{lt.default_days_per_year}d/yr</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${lt.is_paid ? 'text-emerald-400 bg-emerald-500/10' : 'text-purple-400 bg-purple-500/10'}`}>
                      {lt.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to add new type */}
            <form onSubmit={handleCreateTypeSubmit} className="space-y-3 pt-2 border-t border-border-subtle text-xs">
              <h4 className="font-bold text-text-secondary uppercase text-[10px]">Add New Leave Type</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  placeholder="Type Name (e.g. Festival)"
                  className="bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                  required
                />
                <input
                  type="text"
                  value={newTypeCode}
                  onChange={e => setNewTypeCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. FL)"
                  className="bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={newTypeDays}
                  onChange={e => setNewTypeDays(e.target.value)}
                  placeholder="Default Days/Yr"
                  className="bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  required
                />
                <select
                  value={newTypePaid ? '1' : '0'}
                  onChange={e => setNewTypePaid(e.target.value === '1')}
                  className="bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="1">Paid</option>
                  <option value="0">Unpaid</option>
                </select>
              </div>

              {typeError && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {typeError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTypeModalOpen(false)}
                  className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={createTypeMutation.isPending}
                  className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold"
                >
                  Save Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
