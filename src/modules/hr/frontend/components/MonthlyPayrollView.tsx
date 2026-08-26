import { useState, useMemo } from 'react';
import { 
  Calculator, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Edit3, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Users,
  LogOut,
  Printer,
  CreditCard
} from 'lucide-react';
import { 
  usePayrollRun, 
  usePayrollItems, 
  useGeneratePayroll, 
  useOverridePayrollItemNet, 
  useApprovePayrollRun, 
  usePayPayrollItem, 
  useReversePayrollItemPayment, 
  useLockPayrollRun, 
  useReopenPayrollRun,
  useEmployees,
  useSettleEmployeeRelieving
} from '../hooks/useHR';
import type { PayrollItem, PayrollPeriodInput } from '../types/hr.types';
import SalarySlipModal from './SalarySlipModal';

export default function MonthlyPayrollView() {
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [payrollMode, setPayrollMode] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(() => `${currentMonth}-01`);
  const [endDate, setEndDate] = useState(todayStr);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [salaryTypeFilter, setSalaryTypeFilter] = useState<string>('ALL');

  // Modals state
  const [selectedSlipItem, setSelectedSlipItem] = useState<PayrollItem | null>(null);
  const [payingItem, setPayingItem] = useState<PayrollItem | null>(null);
  const [overridingItem, setOverridingItem] = useState<PayrollItem | null>(null);
  const [reversingItem, setReversingItem] = useState<PayrollItem | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  // Relieving Final Settlement Modal state
  const [isRelievingModalOpen, setIsRelievingModalOpen] = useState(false);
  const [relievingEmpId, setRelievingEmpId] = useState<number | ''>('');
  const [relievingDate, setRelievingDate] = useState(todayStr);
  const [relievingReason, setRelievingReason] = useState('');
  const [relievingError, setRelievingError] = useState<string | null>(null);

  // Queries
  const { data: payrollRun, refetch: refetchRun } = usePayrollRun(selectedMonth);
  const { data: rawItems = [], isLoading: isItemsLoading, refetch: refetchItems } = usePayrollItems(selectedMonth, {
    department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    salaryType: salaryTypeFilter !== 'ALL' ? salaryTypeFilter : undefined,
  });
  const items = useMemo(() => Array.isArray(rawItems) ? rawItems : [], [rawItems]);

  const { data: rawEmployees = [], refetch: refetchEmployees } = useEmployees({ includeInactive: true });
  const activeEmployees = useMemo(() => rawEmployees.filter(e => e.is_active === 1), [rawEmployees]);
  const departments = useMemo(() => {
    const set = new Set<string>();
    rawEmployees.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set);
  }, [rawEmployees]);

  // Mutations
  const generateMutation = useGeneratePayroll();
  const overrideMutation = useOverridePayrollItemNet();
  const approveMutation = useApprovePayrollRun();
  const payMutation = usePayPayrollItem();
  const reverseMutation = useReversePayrollItemPayment();
  const lockMutation = useLockPayrollRun();
  const reopenMutation = useReopenPayrollRun();
  const settleRelievingMutation = useSettleEmployeeRelieving();

  // Form states
  const [payMethod, setPayMethod] = useState<'cash' | 'bank' | 'upi' | 'cheque'>('cash');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const [reverseReason, setReverseReason] = useState('');
  const [reverseError, setReverseError] = useState<string | null>(null);

  const [lockNotes, setLockNotes] = useState('All payroll payouts verified and settled');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.full_name?.toLowerCase().includes(q);
        const matchCode = item.emp_code?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [items, searchTerm]);

  // Metric Totals
  const totalEmployees = items.length;
  const totalGrossPaise = useMemo(() => items.reduce((s, i) => s + (i.gross_salary_paise || 0), 0), [items]);
  const totalDeductionsPaise = useMemo(() => items.reduce((s, i) => s + (i.total_deductions_paise || 0), 0), [items]);
  const totalNetPaise = useMemo(() => items.reduce((s, i) => s + (i.net_salary_paise || 0), 0), [items]);
  const paidCount = useMemo(() => items.filter(i => i.status === 'Paid').length, [items]);

  const isLocked = payrollRun?.status === 'Locked';
  const isApproved = payrollRun?.status === 'Approved' || payrollRun?.status === 'Paid' || isLocked;

  const handleGenerate = async (force = false) => {
    try {
      const payload: PayrollPeriodInput = {
        periodType: payrollMode,
        monthYear: selectedMonth,
        startDate: payrollMode !== 'monthly' ? startDate : undefined,
        endDate: payrollMode !== 'monthly' ? endDate : undefined,
        forceRecalculate: force,
      };

      await generateMutation.mutateAsync(payload);
      refetchRun();
      refetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to generate payroll.');
    }
  };

  const handleSettleRelieving = async (e: React.FormEvent) => {
    e.preventDefault();
    setRelievingError(null);
    if (!relievingEmpId) {
      setRelievingError('Please select an employee to relieve.');
      return;
    }
    if (!relievingReason.trim()) {
      setRelievingError('Please specify the relieving or resignation reason.');
      return;
    }

    try {
      const res = await settleRelievingMutation.mutateAsync({
        employee_id: Number(relievingEmpId),
        relieving_date: relievingDate,
        reason: relievingReason.trim(),
      });

      setIsRelievingModalOpen(false);
      setRelievingEmpId('');
      setRelievingReason('');
      refetchEmployees();
      refetchRun();
      refetchItems();

      if (res?.payrollItem) {
        setSelectedSlipItem(res.payrollItem);
      }
    } catch (err: any) {
      setRelievingError(err.message || 'Failed to process final relieving settlement.');
    }
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`Approve all draft salaries for ${selectedMonth}?`)) return;
    try {
      await approveMutation.mutateAsync(selectedMonth);
      refetchRun();
      refetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to approve payroll.');
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (!payingItem) return;

    try {
      await payMutation.mutateAsync({
        itemId: payingItem.id,
        paymentMethod: payMethod,
        paymentDate: payDate,
        paymentReference: payRef.trim() || undefined,
        monthYear: selectedMonth,
        employeeId: payingItem.employee_id,
      });

      setPayingItem(null);
      setPayRef('');
      refetchRun();
      refetchItems();
    } catch (err: any) {
      setPayError(err.message || 'Failed to process payment.');
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError(null);
    if (!overridingItem) return;

    const amtNum = parseFloat(overrideAmount);
    if (isNaN(amtNum) || amtNum < 0) {
      setOverrideError('Please enter a valid net salary.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('A reason is mandatory for manual salary overrides.');
      return;
    }

    try {
      await overrideMutation.mutateAsync({
        itemId: overridingItem.id,
        newNetSalaryPaise: Math.round(amtNum * 100),
        reason: overrideReason.trim(),
        monthYear: selectedMonth,
      });

      setOverridingItem(null);
      setOverrideAmount('');
      setOverrideReason('');
      refetchRun();
      refetchItems();
    } catch (err: any) {
      setOverrideError(err.message || 'Failed to override salary.');
    }
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReverseError(null);
    if (!reversingItem) return;

    if (!reverseReason.trim()) {
      setReverseError('A reason is mandatory for payment reversals.');
      return;
    }

    try {
      await reverseMutation.mutateAsync({
        itemId: reversingItem.id,
        reason: reverseReason.trim(),
        monthYear: selectedMonth,
        employeeId: reversingItem.employee_id,
      });

      setReversingItem(null);
      setReverseReason('');
      refetchRun();
      refetchItems();
    } catch (err: any) {
      setReverseError(err.message || 'Failed to reverse payment.');
    }
  };

  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await lockMutation.mutateAsync({ monthYear: selectedMonth, notes: lockNotes });
      setIsLockModalOpen(false);
      refetchRun();
      refetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to lock payroll.');
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReopenError(null);

    if (!reopenReason.trim()) {
      setReopenError('A reason is strictly mandatory to reopen locked payroll.');
      return;
    }

    try {
      await reopenMutation.mutateAsync({ monthYear: selectedMonth, reason: reopenReason.trim() });
      setIsReopenModalOpen(false);
      setReopenReason('');
      refetchRun();
      refetchItems();
    } catch (err: any) {
      setReopenError(err.message || 'Failed to reopen payroll.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Action Bar: Payroll Cycles & Execution Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Cycle Mode Switcher */}
          <div className="flex items-center bg-surface-panel border border-border-subtle rounded-xl p-1 text-xs">
            <button
              onClick={() => setPayrollMode('monthly')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                payrollMode === 'monthly' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              📅 Monthly
            </button>
            <button
              onClick={() => setPayrollMode('weekly')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                payrollMode === 'weekly' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              🗓️ Weekly
            </button>
            <button
              onClick={() => setPayrollMode('custom')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                payrollMode === 'custom' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              🎯 Custom Period
            </button>
          </div>

          {payrollMode === 'monthly' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-secondary">Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-surface-panel border border-brand-500 rounded-xl px-3 py-1 text-xs font-mono font-bold text-text-primary outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-text-secondary">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-surface-panel border border-brand-500 rounded-xl px-2.5 py-1 text-xs font-mono text-text-primary outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-text-secondary">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-surface-panel border border-brand-500 rounded-xl px-2.5 py-1 text-xs font-mono text-text-primary outline-none"
                />
              </div>
            </div>
          )}

          {/* Relieving / Resignation Settlement Button */}
          <button
            onClick={() => setIsRelievingModalOpen(true)}
            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Settle employee who is resigning or leaving mid-cycle"
          >
            <LogOut size={13} />
            <span>Relieving Settlement</span>
          </button>

          {/* Status Badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            isLocked
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : payrollRun?.status === 'Paid'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : isApproved
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {isLocked ? <Lock size={11} /> : <Clock size={11} />}
            <span>Status: {payrollRun?.status || 'Draft'}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={generateMutation.isPending}
              className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20"
              title="Recalculate numbers from live attendance, OT, incentives & advance recoveries"
            >
              <RefreshCw size={13} className={generateMutation.isPending ? 'animate-spin' : ''} />
              <span>{items.length === 0 ? 'Generate Payroll' : 'Calculate & Refresh'}</span>
            </button>
          )}

          {!isLocked && !isApproved && items.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={approveMutation.isPending}
              className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 size={13} />
              <span>Approve All</span>
            </button>
          )}

          {isLocked ? (
            <button
              onClick={() => setIsReopenModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Unlock size={13} />
              <span>Reopen Payroll</span>
            </button>
          ) : (
            <button
              onClick={() => setIsLockModalOpen(true)}
              className="px-3.5 py-1.5 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Lock month to prevent any further modifications"
            >
              <Lock size={13} />
              <span>Lock Month</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Active Employees</span>
            <div className="text-base font-black text-text-primary font-mono mt-0.5">
              {totalEmployees} Staff
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">{paidCount} Paid • {totalEmployees - paidCount} Pending</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400">Total Gross Earnings</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              ₹{(totalGrossPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Basic + OT + Bonus + Allowances</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-400">Deductions & Recoveries</span>
            <div className="text-base font-black text-rose-400 font-mono mt-0.5">
              -₹{(totalDeductionsPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Advances + Unpaid Leave + Penalties</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-cyan-400">Total Net Payable</span>
            <div className="text-base font-black text-cyan-400 font-mono mt-0.5">
              ₹{(totalNetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Single Source of Truth Net Payout</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Wallet size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search staff by name, employee code..."
              className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 font-bold"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Locked">Locked</option>
          </select>

          <select
            value={salaryTypeFilter}
            onChange={e => setSalaryTypeFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Pay Types</option>
            <option value="Monthly">Monthly</option>
            <option value="Daily">Daily</option>
            <option value="Hourly">Hourly</option>
          </select>
        </div>
      </div>

      {/* Salary Statement Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isItemsLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading payroll statement...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Calculator size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Payroll Generated for {selectedMonth}</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Generate Payroll&quot; to auto-calculate salaries from attendance, advances, and overtime.
            </p>
            {!isLocked && (
              <button
                onClick={() => handleGenerate(false)}
                className="mt-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold"
              >
                Generate {selectedMonth} Payroll
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-3">EMPLOYEE / ID</th>
                  <th className="py-3 px-3 text-center">DAYS (WRK/TOT)</th>
                  <th className="py-3 px-3 text-right">BASIC SALARY</th>
                  <th className="py-3 px-3 text-right">OT PAY</th>
                  <th className="py-3 px-3 text-right">INCENTIVE</th>
                  <th className="py-3 px-3 text-right text-rose-400">ADV. RECOVERY</th>
                  <th className="py-3 px-3 text-right text-rose-400">OTHER DEDUCT</th>
                  <th className="py-3 px-3 text-right text-emerald-400 font-black">NET SALARY</th>
                  <th className="py-3 px-3 text-center">STATUS</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredItems.map(item => {
                  const isPaid = item.status === 'Paid';
                  const isItemLocked = item.status === 'Locked';

                  return (
                    <tr key={item.id} className="hover:bg-surface-hover/30 transition-colors">
                      {/* Employee */}
                      <td className="py-3 px-3 font-sans">
                        <div className="font-bold text-text-primary text-xs">{item.full_name}</div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {item.emp_code} • {item.department} ({item.salary_type})
                        </div>
                      </td>

                      {/* Days */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-text-primary">{item.worked_days}</span>
                        <span className="text-text-muted text-[10px]"> / {item.total_days_in_month}d</span>
                        {item.unpaid_leave_days > 0 && (
                          <div className="text-[9px] text-rose-400 font-bold">({item.unpaid_leave_days}d unpaid)</div>
                        )}
                      </td>

                      {/* Basic */}
                      <td className="py-3 px-3 text-right font-mono text-text-primary">
                        ₹{(item.basic_salary_paise / 100).toFixed(2)}
                      </td>

                      {/* OT */}
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">
                        {item.overtime_amount_paise > 0 ? `+₹${(item.overtime_amount_paise / 100).toFixed(2)}` : '—'}
                      </td>

                      {/* Incentive */}
                      <td className="py-3 px-3 text-right font-mono text-purple-400">
                        {item.incentive_amount_paise > 0 ? `+₹${(item.incentive_amount_paise / 100).toFixed(2)}` : '—'}
                      </td>

                      {/* Advance Recovery */}
                      <td className="py-3 px-3 text-right font-mono text-rose-400">
                        {item.advance_recovery_paise > 0 ? `-₹${(item.advance_recovery_paise / 100).toFixed(2)}` : '—'}
                      </td>

                      {/* Other Deductions */}
                      <td className="py-3 px-3 text-right font-mono text-rose-400">
                        {item.other_deductions_paise > 0 || item.unpaid_leave_deduction_paise > 0 ? (
                          `-₹${((item.other_deductions_paise + item.unpaid_leave_deduction_paise) / 100).toFixed(2)}`
                        ) : '—'}
                      </td>

                      {/* Net Salary */}
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-xs">
                        ₹{(item.net_salary_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {item.is_overridden === 1 && (
                          <div className="text-[9px] text-amber-400 font-normal font-sans" title={item.override_reason || ''}>
                            (Overridden)
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                            : isItemLocked
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : item.status === 'Approved'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {isPaid ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        {/* Slip */}
                        <button
                          onClick={() => setSelectedSlipItem(item)}
                          className="p-1.5 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary rounded-lg border border-border-subtle transition-colors"
                          title="View / Print Salary Slip"
                        >
                          <Printer size={13} />
                        </button>

                        {/* Pay */}
                        {!isPaid && !isItemLocked && (
                          <button
                            onClick={() => {
                              setPayingItem(item);
                              setPayRef(`SAL-${item.month_year}-${item.emp_code}`);
                            }}
                            className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold transition-all"
                            title="Disburse Salary Payment"
                          >
                            Pay ₹
                          </button>
                        )}

                        {/* Override */}
                        {!isPaid && !isItemLocked && (
                          <button
                            onClick={() => {
                              setOverridingItem(item);
                              setOverrideAmount(((item.net_salary_paise || 0) / 100).toString());
                              setOverrideReason(item.override_reason || '');
                            }}
                            className="p-1.5 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary rounded-lg border border-border-subtle transition-colors"
                            title="Manual Net Salary Override (Audit Logged)"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}

                        {/* Reversal */}
                        {isPaid && !isItemLocked && (
                          <button
                            onClick={() => setReversingItem(item)}
                            className="p-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg border border-rose-500/30 transition-colors"
                            title="Reverse Payment (Requires Reason)"
                          >
                            <RotateCcw size={13} />
                          </button>
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

      {/* Salary Slip Modal */}
      {selectedSlipItem && (
        <SalarySlipModal
          item={selectedSlipItem}
          onClose={() => setSelectedSlipItem(null)}
        />
      )}

      {/* Pay Salary Modal */}
      {payingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Disburse Salary Payment</h3>
              </div>
              <button
                onClick={() => setPayingItem(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Employee:</span>
                <span className="font-bold text-text-primary">{payingItem.full_name} ({payingItem.emp_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Gross Earnings:</span>
                <span className="font-bold text-text-primary">₹{(payingItem.gross_salary_paise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Deductions:</span>
                <span className="font-bold text-rose-400">-₹{(payingItem.total_deductions_paise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border-subtle/60 pt-1.5 text-sm">
                <span className="text-text-secondary font-bold">Net Payout Amount:</span>
                <span className="font-black text-emerald-400">₹{(payingItem.net_salary_paise / 100).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="cash">Cash (Auto Cash Box Cash-Out)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Payment Reference / Transaction ID</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="e.g. UTR / UPI Ref / Cheque No"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                />
              </div>

              {payMethod === 'cash' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  <strong>Notice:</strong> Paying in Cash will automatically record a matching Cash-Out entry in the active Cash Box drawer and post a salary disbursement debit in the employee ledger.
                </div>
              )}

              {payError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {payError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingItem(null)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payMutation.isPending}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20"
                >
                  {payMutation.isPending ? 'Processing...' : 'Confirm Disbursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {overridingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Edit3 size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Manual Net Salary Override</h3>
              </div>
              <button
                onClick={() => setOverridingItem(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Employee:</span>
                  <span className="font-bold text-text-primary">{overridingItem.full_name} ({overridingItem.emp_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Calculated Net Salary:</span>
                  <span className="font-bold font-mono text-emerald-400">
                    ₹{((overridingItem.original_net_salary_paise ?? overridingItem.net_salary_paise) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">New Net Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={overrideAmount}
                  onChange={e => setOverrideAmount(e.target.value)}
                  className="w-full bg-surface-card border border-brand-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">
                  Reason for Override <span className="text-rose-400">* (Mandatory & Audit Logged)</span>
                </label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="e.g. Special festival advance adjustment or agreed management correction"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {overrideError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {overrideError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverridingItem(null)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {overrideMutation.isPending ? 'Updating...' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Reversal Modal */}
      {reversingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <RotateCcw size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Reverse Salary Payment</h3>
              </div>
              <button
                onClick={() => setReversingItem(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Employee:</span>
                  <span className="font-bold text-text-primary">{reversingItem.full_name} ({reversingItem.emp_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Paid Amount:</span>
                  <span className="font-bold font-mono text-rose-400">
                    ₹{(reversingItem.net_salary_paise / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">
                  Reason for Reversal <span className="text-rose-400">* (Mandatory)</span>
                </label>
                <textarea
                  rows={2}
                  value={reverseReason}
                  onChange={e => setReverseReason(e.target.value)}
                  placeholder="e.g. Wrong bank account / duplicate transfer reversal"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {reverseError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {reverseError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversingItem(null)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reverseMutation.isPending}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-rose-500/20"
                >
                  {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lock Month Modal */}
      {isLockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Lock size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Lock Payroll Month ({selectedMonth})</h3>
              </div>
              <button
                onClick={() => setIsLockModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLockSubmit} className="space-y-3.5 text-xs">
              <p className="text-text-secondary leading-relaxed">
                Locking this payroll month freezes all attendance records, advances, and payroll lines. No further calculations or edits will occur automatically.
              </p>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Notes</label>
                <input
                  type="text"
                  value={lockNotes}
                  onChange={e => setLockNotes(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLockModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lockMutation.isPending}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-rose-500/20"
                >
                  {lockMutation.isPending ? 'Locking...' : 'Lock Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Month Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Unlock size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Reopen Locked Payroll ({selectedMonth})</h3>
              </div>
              <button
                onClick={() => setIsReopenModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-3.5 text-xs">
              <p className="text-text-secondary leading-relaxed">
                Reopening allows salary lines and attendance for {selectedMonth} to be modified and recalculated. This action requires Admin authorization and is permanently logged in the audit trail.
              </p>

              <div>
                <label className="font-bold text-text-secondary block mb-1">
                  Reason for Reopening <span className="text-rose-400">* (Mandatory)</span>
                </label>
                <textarea
                  rows={2}
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  placeholder="e.g. Correcting missed overtime shift approval"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {reopenError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {reopenError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopenMutation.isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-amber-500/20"
                >
                  {reopenMutation.isPending ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relieving / Resignation Final Settlement Modal */}
      {isRelievingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <LogOut size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Employee Relieving & Settlement</h3>
                  <p className="text-[10px] text-text-muted">Compute final settlement & recover outstanding advances</p>
                </div>
              </div>
              <button
                onClick={() => setIsRelievingModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleRelieving} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Select Relieving Employee <span className="text-rose-400">*</span></label>
                <select
                  value={relievingEmpId}
                  onChange={e => setRelievingEmpId(Number(e.target.value) || '')}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code} - {e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Relieving / Last Working Date <span className="text-rose-400">*</span></label>
                <input
                  type="date"
                  value={relievingDate}
                  onChange={e => setRelievingDate(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">
                  Reason for Leaving / Resignation <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={relievingReason}
                  onChange={e => setRelievingReason(e.target.value)}
                  placeholder="e.g. Relocating to hometown / Personal reasons / Contract completed"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                <p className="font-bold">Final Settlement Actions:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
                  <li>Calculates earned basic salary up to the relieving date.</li>
                  <li>Automatically deducts 100% of any pending unrecovered advances.</li>
                  <li>Updates employee status to <span className="font-bold text-rose-400">Relieved</span> and deactivates profile.</li>
                  <li>Generates Final Settlement Salary Slip ready for print/export.</li>
                </ul>
              </div>

              {relievingError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {relievingError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRelievingModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleRelievingMutation.isPending}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-rose-500/20"
                >
                  {settleRelievingMutation.isPending ? 'Settling...' : 'Complete Final Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
