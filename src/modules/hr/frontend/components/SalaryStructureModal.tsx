import { useState, useEffect } from 'react';
import { X, DollarSign, Plus, Trash2, ShieldCheck, AlertCircle, Info, Sliders } from 'lucide-react';
import { useSalaryStructure, useUpdateSalaryStructure } from '../hooks/useHR';
import type { Employee, PayType, FixedAllowance, DeductionRule } from '../types/hr.types';

interface Props {
  employee: Employee;
  onClose: () => void;
}

export default function SalaryStructureModal({ employee, onClose }: Props) {
  const { data: salaryStruct, isLoading } = useSalaryStructure(employee.id);
  const updateMutation = useUpdateSalaryStructure();

  const [payType, setPayType] = useState<PayType>(employee.salary_type || 'Monthly');
  const [basicSalary, setBasicSalary] = useState<string>('20000');
  const [overtimeRate, setOvertimeRate] = useState<string>('0');
  const [attendanceBased, setAttendanceBased] = useState<boolean>(false);
  const [incentiveRuleRef, setIncentiveRuleRef] = useState<string>('');
  const [allowances, setAllowances] = useState<FixedAllowance[]>([]);
  const [deductions, setDeductions] = useState<DeductionRule[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Allowance Form State
  const [newAllowanceName, setNewAllowanceName] = useState('');
  const [newAllowanceAmount, setNewAllowanceAmount] = useState('');

  // Deduction Form State
  const [newDeductionName, setNewDeductionName] = useState('');
  const [newDeductionType, setNewDeductionType] = useState('fixed');
  const [newDeductionAmount, setNewDeductionAmount] = useState('');

  useEffect(() => {
    if (salaryStruct) {
      setPayType(salaryStruct.pay_type || employee.salary_type || 'Monthly');
      setBasicSalary(((salaryStruct.basic_salary_paise || employee.basic_salary_paise || 0) / 100).toString());
      setOvertimeRate(((salaryStruct.overtime_rate_paise || 0) / 100).toString());
      setAttendanceBased(Boolean(salaryStruct.attendance_based_salary));
      setIncentiveRuleRef(salaryStruct.incentive_rule_ref || '');
      setEffectiveFrom(salaryStruct.effective_from || new Date().toISOString().slice(0, 10));

      if (Array.isArray(salaryStruct.fixed_allowances)) {
        setAllowances(salaryStruct.fixed_allowances);
      }
      if (Array.isArray(salaryStruct.deduction_rules)) {
        setDeductions(salaryStruct.deduction_rules);
      }
    } else if (employee) {
      setPayType(employee.salary_type || 'Monthly');
      setBasicSalary(((employee.basic_salary_paise || 2000000) / 100).toString());
      setAttendanceBased(employee.salary_type === 'Daily');
    }
  }, [salaryStruct, employee]);

  const handleAddAllowance = () => {
    if (!newAllowanceName.trim()) return;
    const amt = parseFloat(newAllowanceAmount);
    if (isNaN(amt) || amt <= 0) return;

    setAllowances(prev => [...prev, { name: newAllowanceName.trim(), amount_paise: Math.round(amt * 100) }]);
    setNewAllowanceName('');
    setNewAllowanceAmount('');
  };

  const handleRemoveAllowance = (idx: number) => {
    setAllowances(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddDeduction = () => {
    if (!newDeductionName.trim()) return;
    const val = parseFloat(newDeductionAmount);
    if (isNaN(val) || val <= 0) return;

    setDeductions(prev => [
      ...prev,
      { name: newDeductionName.trim(), type: newDeductionType, rate_or_amount: Math.round(val * 100) }
    ]);
    setNewDeductionName('');
    setNewDeductionAmount('');
  };

  const handleRemoveDeduction = (idx: number) => {
    setDeductions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const basicNum = parseFloat(basicSalary);
    if (isNaN(basicNum) || basicNum < 0) {
      setErrorMsg('Please enter a valid basic salary.');
      return;
    }

    const otNum = parseFloat(overtimeRate) || 0;

    try {
      await updateMutation.mutateAsync({
        employee_id: employee.id,
        pay_type: payType,
        basic_salary_paise: Math.round(basicNum * 100),
        overtime_rate_paise: Math.round(otNum * 100),
        fixed_allowances: allowances,
        attendance_based_salary: attendanceBased,
        incentive_rule_ref: incentiveRuleRef.trim() || null,
        deduction_rules: deductions,
        effective_from: effectiveFrom,
      });

      setSuccessMsg('Salary structure rules saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save salary structure.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-text-primary flex items-center gap-2">
                <span>Salary Structure:</span>
                <span className="text-brand-400">{employee.full_name}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-panel text-text-muted border border-border-subtle">
                  {employee.emp_code}
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Define the compensation rules and allowances for this employee.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informational Alert */}
        <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-cyan-300 flex-shrink-0">
          <Info size={15} className="flex-shrink-0 text-cyan-400" />
          <span>
            This section only stores calculation <strong>rules</strong>. The payroll engine (Phase 3) automatically computes net payouts from attendance and these rules.
          </span>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-muted">Loading salary structure...</div>
          ) : (
            <>
              {/* Pay Type & Basic Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Pay Type</label>
                  <select
                    value={payType}
                    onChange={e => {
                      const newType = e.target.value as PayType;
                      setPayType(newType);
                      if (newType === 'Daily') setAttendanceBased(true);
                    }}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="Monthly">Monthly Salary</option>
                    <option value="Daily">Daily Wage</option>
                    <option value="Hourly">Hourly Rate</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">
                    Basic Salary ({payType === 'Monthly' ? '₹ / Month' : payType === 'Daily' ? '₹ / Day' : '₹ / Hour'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={basicSalary}
                    onChange={e => setBasicSalary(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    placeholder="e.g. 20000"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Overtime Rate (₹ / Hour)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overtimeRate}
                    onChange={e => setOvertimeRate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    placeholder="e.g. 100"
                  />
                </div>
              </div>

              {/* Attendance-Based Salary Flag & Effective Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-surface-card border border-border-subtle rounded-xl">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="attendanceBasedCheckbox"
                    checked={attendanceBased}
                    onChange={e => setAttendanceBased(e.target.checked)}
                    className="mt-0.5 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
                  />
                  <label htmlFor="attendanceBasedCheckbox" className="text-xs cursor-pointer">
                    <span className="font-bold text-text-primary block">Strict Attendance-Based Pay</span>
                    <span className="text-[11px] text-text-muted">
                      {attendanceBased
                        ? 'Pay is calculated strictly as worked days × daily rate.'
                        : 'Fixed monthly compensation regardless of minor attendance variances.'}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={e => setEffectiveFrom(e.target.value)}
                    className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Fixed Allowances Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Fixed Monthly Allowances
                  </h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    Total: ₹{(allowances.reduce((sum, a) => sum + (a.amount_paise || 0), 0) / 100).toFixed(2)}
                  </span>
                </div>

                {allowances.length > 0 && (
                  <div className="space-y-1.5">
                    {allowances.map((a, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-surface-card border border-border-subtle text-xs"
                      >
                        <span className="font-bold text-text-primary">{a.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-400">
                            +₹{(a.amount_paise / 100).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllowance(idx)}
                            className="text-text-muted hover:text-rose-400 transition-colors p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAllowanceName}
                    onChange={e => setNewAllowanceName(e.target.value)}
                    placeholder="Allowance Name (e.g. Food / Transport)"
                    className="flex-1 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newAllowanceAmount}
                    onChange={e => setNewAllowanceAmount(e.target.value)}
                    placeholder="Amount ₹"
                    className="w-28 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAllowance}
                    className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* Standard Deductions Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Standard Deductions (e.g. Unpaid Leave, Late Penalties)
                  </h3>
                </div>

                {deductions.length > 0 && (
                  <div className="space-y-1.5">
                    {deductions.map((d, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-surface-card border border-border-subtle text-xs"
                      >
                        <span className="font-bold text-text-primary">{d.name} ({d.type})</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-rose-400">
                            -₹{((d.rate_or_amount || 0) / 100).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDeduction(idx)}
                            className="text-text-muted hover:text-rose-400 transition-colors p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeductionName}
                    onChange={e => setNewDeductionName(e.target.value)}
                    placeholder="Deduction Name (e.g. Unpaid Leave / Advance)"
                    className="flex-1 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-rose-500"
                  />
                  <select
                    value={newDeductionType}
                    onChange={e => setNewDeductionType(e.target.value)}
                    className="bg-surface-card border border-border-subtle rounded-xl px-2 py-1.5 text-xs text-text-primary outline-none focus:border-rose-500"
                  >
                    <option value="fixed">Fixed ₹</option>
                    <option value="per_day">Per Day ₹</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={newDeductionAmount}
                    onChange={e => setNewDeductionAmount(e.target.value)}
                    placeholder="Amount ₹"
                    className="w-24 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDeduction}
                    className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* Incentive Rule Reference */}
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Incentive Rule Reference (Optional)</label>
                <input
                  type="text"
                  value={incentiveRuleRef}
                  onChange={e => setIncentiveRuleRef(e.target.value)}
                  placeholder="e.g. CUTTING_YIELD_BONUS_TIER_1"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Connects to the cutting/sales incentive rules configured in Phase 2.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <ShieldCheck size={14} className="flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted hover:text-text-primary rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Sliders size={14} />
              <span>{updateMutation.isPending ? 'Saving Rules...' : 'Save Salary Structure'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
