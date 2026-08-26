import { useState, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building,
  Coffee,
  Car,
  Shirt,
  HeartPulse,
  Smartphone
} from 'lucide-react';
import { useEmployeeExpenses, useCreateEmployeeExpense, useEmployees } from '../hooks/useHR';
import type { ExpenseFlag } from '../../shared/hr.types';

const CATEGORIES = [
  { label: 'Travel & Logistics', value: 'Travel', icon: Car },
  { label: 'Staff Food & Refreshments', value: 'Food', icon: Coffee },
  { label: 'Uniform & Safety Gear', value: 'Uniform', icon: Shirt },
  { label: 'Medical Reimbursement', value: 'Medical Reimbursement', icon: HeartPulse },
  { label: 'Phone / Internet Recharge', value: 'Phone Recharge', icon: Smartphone },
  { label: 'General / Other', value: 'Other', icon: Tag },
];

export default function EmployeeExpensesView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [flagFilter, setFlagFilter] = useState<'ALL' | ExpenseFlag>('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState<number | 'ALL'>('ALL');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Queries
  const { data: rawExpenses = [], isLoading, isError, error, refetch } = useEmployeeExpenses({
    employeeId: selectedEmpId !== 'ALL' ? selectedEmpId : undefined,
    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
    flag: flagFilter !== 'ALL' ? flagFilter : undefined,
  });
  const expenses = useMemo(() => Array.isArray(rawExpenses) ? rawExpenses : [], [rawExpenses]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const createExpenseMutation = useCreateEmployeeExpense();

  // Form State
  const [expEmpId, setExpEmpId] = useState<number | ''>('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState('Food');
  const [expFlag, setExpFlag] = useState<ExpenseFlag>('Reimbursable');
  const [expDescription, setExpDescription] = useState('');
  const [expReceipt, setExpReceipt] = useState('');
  const [expError, setExpError] = useState<string | null>(null);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = e.full_name?.toLowerCase().includes(q);
        const matchCode = e.emp_code?.toLowerCase().includes(q);
        const matchDesc = e.description?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDesc) return false;
      }
      return true;
    });
  }, [expenses, searchTerm]);

  // Metric Totals
  const reimbursableTotalPaise = useMemo(() => {
    return expenses.filter(e => e.flag === 'Reimbursable').reduce((s, e) => s + (e.amount_paise || 0), 0);
  }, [expenses]);

  const deductionTotalPaise = useMemo(() => {
    return expenses.filter(e => e.flag === 'Salary Deduction').reduce((s, e) => s + (e.amount_paise || 0), 0);
  }, [expenses]);

  const companyExpenseTotalPaise = useMemo(() => {
    return expenses.filter(e => e.flag === 'Company Expense').reduce((s, e) => s + (e.amount_paise || 0), 0);
  }, [expenses]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError(null);

    if (!expEmpId) {
      setExpError('Please select an employee.');
      return;
    }
    const amtNum = parseFloat(expAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setExpError('Please enter a valid expense amount.');
      return;
    }
    if (!expDescription.trim()) {
      setExpError('Please enter a description for the expense.');
      return;
    }

    try {
      await createExpenseMutation.mutateAsync({
        employee_id: Number(expEmpId),
        expense_date: expDate,
        amount_paise: Math.round(amtNum * 100),
        category: expCategory,
        description: expDescription.trim(),
        flag: expFlag,
        receipt_url: expReceipt.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setExpAmount('');
      setExpDescription('');
      setExpReceipt('');
      refetch();
    } catch (err: any) {
      setExpError(err.message || 'Failed to record expense.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400">Reimbursable (Owed to Staff)</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              ₹{(reimbursableTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Adds as credit in payroll</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-400">Salary Deduction</span>
            <div className="text-base font-black text-rose-400 font-mono mt-0.5">
              ₹{(deductionTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Subtracts as debit in payroll</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-cyan-400">Company Expense</span>
            <div className="text-base font-black text-cyan-400 font-mono mt-0.5">
              ₹{(companyExpenseTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">For reference only (0 payroll impact)</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Building size={18} />
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
              placeholder="Search expenses by employee, description..."
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
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={flagFilter}
            onChange={e => setFlagFilter(e.target.value as any)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Flags</option>
            <option value="Reimbursable">Reimbursable (+Pay)</option>
            <option value="Salary Deduction">Salary Deduction (-Pay)</option>
            <option value="Company Expense">Company Expense (0)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
            title="Refresh Expenses"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading employee expenses...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load expenses</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Receipt size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Expenses Found</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Record Expense&quot; above to log staff travel, food, or safety expenses.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">DATE & CATEGORY</th>
                  <th className="py-3 px-4">DESCRIPTION</th>
                  <th className="py-3 px-4 text-center">ACCOUNTING NATURE (FLAG)</th>
                  <th className="py-3 px-4 text-right">AMOUNT</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredExpenses.map(exp => {
                  const isReimbursable = exp.flag === 'Reimbursable';
                  const isDeduction = exp.flag === 'Salary Deduction';

                  return (
                    <tr key={exp.id} className="hover:bg-surface-hover/30 transition-colors">
                      {/* Employee */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-text-primary text-xs">{exp.full_name}</div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {exp.emp_code} • {exp.department}
                        </div>
                      </td>

                      {/* Date & Category */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-text-primary">{exp.expense_date}</div>
                        <div className="text-[11px] text-brand-400 font-bold mt-0.5">
                          {exp.category}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-text-secondary max-w-[240px] truncate" title={exp.description}>
                        {exp.description}
                      </td>

                      {/* Accounting Flag */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isReimbursable
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isDeduction
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {isReimbursable && '+ Reimbursable (Credit)'}
                          {isDeduction && '- Salary Deduction (Debit)'}
                          {!isReimbursable && !isDeduction && 'Company Expense (Ref)'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`py-3.5 px-4 text-right font-mono font-bold text-xs ${
                        isReimbursable ? 'text-emerald-400' : isDeduction ? 'text-rose-400' : 'text-text-primary'
                      }`}>
                        ₹{(exp.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle2 size={10} />
                          <span>Approved</span>
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

      {/* Record Expense Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Receipt size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Record Staff Expense</h3>
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
                  value={expEmpId}
                  onChange={e => setExpEmpId(Number(e.target.value) || '')}
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
                  <label className="font-bold text-text-secondary block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    placeholder="e.g. 750"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Accounting Flag</label>
                  <select
                    value={expFlag}
                    onChange={e => setExpFlag(e.target.value as ExpenseFlag)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="Reimbursable">Reimbursable (+Pay)</option>
                    <option value="Salary Deduction">Salary Deduction (-Pay)</option>
                    <option value="Company Expense">Company Expense (0)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Description / Bill Notes</label>
                <textarea
                  rows={2}
                  value={expDescription}
                  onChange={e => setExpDescription(e.target.value)}
                  placeholder="e.g. Fuel expense for meat delivery to customer"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {expError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {expError}
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
                  disabled={createExpenseMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
