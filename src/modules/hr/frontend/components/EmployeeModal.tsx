import { useState, useEffect } from 'react';
import { X, User, Briefcase, ShieldAlert, FileText, Plus, Check } from 'lucide-react';
import { useCreateEmployee, useUpdateEmployee, useHRRoles, useCreateHRRole } from '../hooks/useHR';
import type { Employee, PayType } from '../types/hr.types';

interface Props {
  employee?: Employee | null;
  onClose: () => void;
}

export default function EmployeeModal({ employee, onClose }: Props) {
  const isEditing = Boolean(employee);
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const { data: roles = [] } = useHRRoles();
  const createRoleMutation = useCreateHRRole();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState('Operations');
  const [role, setRole] = useState('Cashier');
  const [customRoleName, setCustomRoleName] = useState('');
  const [isAddingCustomRole, setIsAddingCustomRole] = useState(false);
  const [salaryType, setSalaryType] = useState<PayType>('Monthly');
  const [salaryCycle, setSalaryCycle] = useState<string>('Monthly');
  const [salaryCycleStartDay, setSalaryCycleStartDay] = useState<string>('Monday');
  const [basicSalary, setBasicSalary] = useState('20000');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [documentsNotes, setDocumentsNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setFullName(employee.full_name || '');
      setMobile(employee.mobile || '');
      setEmail(employee.email || '');
      setAddress(employee.address || '');
      setJoiningDate(employee.joining_date || new Date().toISOString().slice(0, 10));
      setDepartment(employee.department || 'Operations');
      setRole(employee.role || 'Cashier');
      setSalaryType(employee.salary_type || 'Monthly');
      setSalaryCycle(employee.salary_cycle || 'Monthly');
      setSalaryCycleStartDay(employee.salary_cycle_start_day || 'Monday');
      setBasicSalary(((employee.basic_salary_paise || 2000000) / 100).toString());
      setEmergencyName(employee.emergency_contact_name || employee.emergency_contact || '');
      setEmergencyPhone(employee.emergency_contact_phone || '');
      setBankAccount(employee.bank_account || '');
      setIfscCode(employee.ifsc_code || '');
      setUpiId(employee.upi_id || '');
      setAadhaarNumber(employee.aadhaar_number || '');
      setPanNumber(employee.pan_number || '');
      setDocumentsNotes(employee.documents_notes || '');
    }
  }, [employee]);

  const handleSaveCustomRole = async () => {
    if (!customRoleName.trim()) return;
    try {
      const created = await createRoleMutation.mutateAsync({ name: customRoleName.trim() });
      setRole(created.name);
      setCustomRoleName('');
      setIsAddingCustomRole(false);
    } catch (err) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter employee full name.');
      return;
    }
    if (!mobile.trim()) {
      setErrorMsg('Please enter mobile number.');
      return;
    }

    const basicNum = parseFloat(basicSalary);
    if (isNaN(basicNum) || basicNum < 0) {
      setErrorMsg('Please enter a valid basic salary.');
      return;
    }

    try {
      if (isEditing && employee) {
        await updateMutation.mutateAsync({
          id: employee.id,
          input: {
            full_name: fullName.trim(),
            mobile: mobile.trim(),
            email: email.trim() || null,
            address: address.trim() || null,
            joining_date: joiningDate,
            department,
            role,
            designation: role,
            salary_type: salaryType,
            salary_cycle: salaryCycle as any,
            salary_cycle_start_day: salaryCycleStartDay,
            basic_salary_paise: Math.round(basicNum * 100),
            emergency_contact_name: emergencyName.trim() || null,
            emergency_contact_phone: emergencyPhone.trim() || null,
            emergency_contact: emergencyPhone.trim() || emergencyName.trim() || null,
            bank_account: bankAccount.trim() || null,
            ifsc_code: ifscCode.trim() || null,
            upi_id: upiId.trim() || null,
            aadhaar_number: aadhaarNumber.trim() || null,
            pan_number: panNumber.trim() || null,
            documents_notes: documentsNotes.trim() || null,
          },
        });
      } else {
        await createMutation.mutateAsync({
          full_name: fullName.trim(),
          mobile: mobile.trim(),
          email: email.trim() || null,
          address: address.trim() || null,
          joining_date: joiningDate,
          department,
          role,
          designation: role,
          salary_type: salaryType,
          salary_cycle: salaryCycle as any,
          salary_cycle_start_day: salaryCycleStartDay,
          basic_salary_paise: Math.round(basicNum * 100),
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          emergency_contact: emergencyPhone.trim() || emergencyName.trim() || null,
          bank_account: bankAccount.trim() || null,
          ifsc_code: ifscCode.trim() || null,
          upi_id: upiId.trim() || null,
          aadhaar_number: aadhaarNumber.trim() || null,
          pan_number: panNumber.trim() || null,
          documents_notes: documentsNotes.trim() || null,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save employee profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-text-primary">
                {isEditing ? `Edit Employee: ${employee?.full_name}` : 'Add New Employee'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {isEditing ? `Employee Code: ${employee?.emp_code}` : 'Sequential ID is automatically generated upon saving.'}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: Basic Profile */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5 border-b border-border-subtle pb-1">
              <User size={13} />
              <span>Personal & Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-text-secondary block mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-bold outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">
                  Mobile Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  placeholder="e.g. Brother / Wife"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="e.g. 9876500000"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Door no, Street, Area, City"
                className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Section 2: Job Role & Compensation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-border-subtle pb-1">
              <Briefcase size={13} />
              <span>Job Role & Compensation Structure</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Date of Joining</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={e => setJoiningDate(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="Operations">Operations</option>
                  <option value="Processing">Processing / Cutting</option>
                  <option value="Sales">Sales & Billing</option>
                  <option value="Management">Management</option>
                  <option value="Logistics">Logistics & Delivery</option>
                  <option value="Sanitation">Cleaning & Hygiene</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Role / Designation</label>
                {!isAddingCustomRole ? (
                  <div className="flex gap-1.5">
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                      {!roles.some(r => r.name === role) && (
                        <option value={role}>{role}</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomRole(true)}
                      className="px-2 py-1 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-xl text-xs text-text-muted hover:text-text-primary"
                      title="Add Custom Role"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={customRoleName}
                      onChange={e => setCustomRoleName(e.target.value)}
                      placeholder="New role name"
                      className="w-full bg-surface-card border border-brand-500 rounded-xl px-2 py-1.5 text-xs text-text-primary outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomRole}
                      className="p-1.5 bg-brand-500 text-white rounded-xl"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomRole(false)}
                      className="p-1.5 bg-surface-card text-text-muted rounded-xl"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Wage Basis</label>
                <select
                  value={salaryType}
                  onChange={e => setSalaryType(e.target.value as PayType)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="Monthly">Monthly Fixed</option>
                  <option value="Daily">Daily Wage</option>
                  <option value="Hourly">Hourly Rate</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">
                  Salary Life Cycle
                </label>
                <select
                  value={salaryCycle}
                  onChange={e => setSalaryCycle(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="Monthly">Monthly Cycle (1st to End)</option>
                  <option value="Weekly">Weekly Cycle</option>
                  <option value="Bi-Weekly">Bi-Weekly (15 Days)</option>
                  <option value="Daily">Daily Payout</option>
                  <option value="Custom">Custom Date Range</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">
                  Cycle Start Day
                </label>
                <select
                  value={salaryCycleStartDay}
                  onChange={e => setSalaryCycleStartDay(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="Monday">Monday (e.g. Mon-Sun)</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                  <option value="1st of Month">1st of Month</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">
                  Basic Salary ({salaryType === 'Monthly' ? '₹ / Month' : salaryType === 'Daily' ? '₹ / Day' : '₹ / Hour'})
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
            </div>

            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Bank / UPI Details (For Payouts)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  placeholder="Bank Acc No."
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="UPI ID (e.g. mob@upi)"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Identity & Notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 border-b border-border-subtle pb-1">
              <FileText size={13} />
              <span>Identity & Document Notes</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Aadhaar Card No.</label>
                <input
                  type="text"
                  value={aadhaarNumber}
                  onChange={e => setAadhaarNumber(e.target.value)}
                  placeholder="12-digit Aadhaar"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">PAN Card No.</label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="10-digit PAN"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={e => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="Bank IFSC"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Document / Background Notes</label>
              <input
                type="text"
                value={documentsNotes}
                onChange={e => setDocumentsNotes(e.target.value)}
                placeholder="e.g. Aadhaar copy verified, police verification done, etc."
                className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <ShieldAlert size={14} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
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
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
            >
              {isEditing
                ? updateMutation.isPending ? 'Saving...' : 'Update Employee'
                : createMutation.isPending ? 'Creating...' : 'Save & Register Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
