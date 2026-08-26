export type PayType = 'Monthly' | 'Daily' | 'Hourly';
export type SalaryCycle = 'Monthly' | 'Weekly' | 'Bi-Weekly' | 'Daily' | 'Custom';

export type AttendanceStatus = 
  | 'Present' 
  | 'Absent' 
  | 'Half_Day' 
  | 'Leave_Paid' 
  | 'Leave_Unpaid' 
  | 'Late' 
  | 'Holiday' 
  | 'Weekly_Off';

export interface FixedAllowance {
  name: string;
  amount_paise: number;
}

export interface DeductionRule {
  name: string;
  type: string;
  rate_or_amount: number;
}

export interface Employee {
  id: number;
  store_id: number;
  emp_code: string;
  full_name: string;
  gender: string;
  dob: string | null;
  mobile: string;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  joining_date: string;
  department: string;
  designation: string;
  role: string;
  employment_type: string;
  shift: string;
  salary_type: PayType;
  salary_cycle?: SalaryCycle;
  salary_cycle_start_day?: string;
  relieving_date?: string | null;
  relieving_reason?: string | null;
  relieving_settled?: number;
  status: 'Active' | 'Inactive' | 'On-Leave' | 'Terminated' | 'Relieved';
  aadhaar_number: string | null;
  pan_number: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  basic_salary_paise: number;
  hra_paise: number;
  allowance_paise: number;
  photo_url?: string | null;
  documents_notes?: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
  salary_structure?: SalaryStructure | null;
}

export interface SalaryStructure {
  id?: number;
  employee_id: number;
  pay_type: PayType;
  basic_salary_paise: number;
  fixed_allowances_json: string | FixedAllowance[];
  fixed_allowances?: FixedAllowance[];
  overtime_rate_paise: number;
  incentive_rule_ref: string | null;
  attendance_based_salary: number; // 1 or 0
  deduction_rules_json: string | DeductionRule[];
  deduction_rules?: DeductionRule[];
  effective_from: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeAttendance {
  id?: number;
  store_id?: number;
  employee_id: number;
  date: string; // 'YYYY-MM-DD'
  clock_in?: string | null;
  clock_out?: string | null;
  status: AttendanceStatus;
  working_hours?: number;
  overtime_hours?: number;
  notes?: string | null;
  is_modified?: number;
  modified_reason?: string | null;
  modified_at?: string | null;
  modified_by?: number | null;
  is_active?: number;
}

export interface MonthAttendanceGridData {
  month_year: string; // 'YYYY-MM'
  is_locked: boolean;
  lock_info?: {
    locked_at: string;
    locked_by_name?: string;
    notes?: string;
  } | null;
  days_in_month: number;
  days: {
    day_num: number;
    date_str: string;
    day_of_week: string;
    is_weekend: boolean;
  }[];
  employees: {
    id: number;
    emp_code: string;
    full_name: string;
    role: string;
    department: string;
    salary_type: PayType;
    attendance: Record<string, EmployeeAttendance>;
    worked_days: number;
    present_count: number;
    absent_count: number;
    half_day_count: number;
    paid_leave_count: number;
    unpaid_leave_count: number;
    late_count: number;
    holiday_count: number;
    weekly_off_count: number;
    overtime_hours_total: number;
  }[];
}

export interface HRLeaveType {
  id: number;
  name: string;
  code: string;
  default_days_per_year: number;
  is_paid: number;
  description?: string | null;
}

export interface EmployeeLeave {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  leave_type_id: number;
  leave_type?: string;
  leave_type_name?: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_paid: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  rejection_reason?: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approval_notes?: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export interface LeaveBalance {
  employee_id?: number;
  emp_code?: string;
  full_name?: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  is_paid: number;
  total_entitled?: number;
  allocated_days?: number;
  used_days: number;
  pending_days?: number;
  available_days?: number;
  remaining_days?: number;
}

export interface HRRole {
  id: number;
  role_name: string;
  name?: string;
  department: string;
  description?: string | null;
  base_daily_hours?: number;
  is_active: number;
}

export interface HRLockRecord {
  id: number;
  month_year: string;
  is_locked: number;
  locked_by: number;
  locked_by_name?: string;
  locked_at: string;
  notes?: string | null;
}

// Phase 2: Employee Ledger, Advances, Expenses, Incentives, Overtime, Deductions

export type ExpenseFlag = 
  | 'Reimbursable' 
  | 'Salary Deduction' 
  | 'Company Expense' 
  | 'company_expense' 
  | 'employee_expense' 
  | 'deduct_from_salary';

export type LedgerEntryType = 
  | 'advance' 
  | 'advance_disbursement'
  | 'advance_recovery' 
  | 'expense_claim' 
  | 'expense_reimbursement' 
  | 'expense_deduction'
  | 'company_expense'
  | 'incentive' 
  | 'overtime' 
  | 'deduction' 
  | 'salary_credit' 
  | 'salary_payout';

export interface EmployeeLedgerEntry {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  entry_date: string;
  entry_type: LedgerEntryType;
  debit_paise: number;
  credit_paise: number;
  balance_paise: number;
  running_balance_paise?: number;
  reference_type: string;
  reference_id?: number | null;
  reference_number?: string | null;
  description?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export type AdvanceStatus = 'Active' | 'Recovering' | 'Fully Recovered' | 'Written Off';
export type AdvanceRepaymentMode = 'salary_deduction' | 'cash' | 'custom_installments';

export interface EmployeeAdvance {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  amount_paise: number;
  advance_date: string;
  reason: string;
  payment_mode: 'cash' | 'bank' | 'upi';
  repayment_mode?: AdvanceRepaymentMode;
  monthly_recovery_paise?: number;
  recovered_amount_paise: number;
  remaining_balance_paise: number;
  remaining_amount_paise: number;
  status: AdvanceStatus;
  approved_by?: number | null;
  approved_by_name?: string | null;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export type ExpenseCategory = 'Travel' | 'Supplies' | 'Food' | 'Customer Care' | 'Maintenance' | 'Emergency Purchase' | 'Other';
export type ExpenseStatus = 'Pending' | 'Approved' | 'Reimbursed' | 'Settled' | 'Rejected';

export interface EmployeeExpense {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  expense_date: string;
  category: ExpenseCategory;
  amount_paise: number;
  description: string;
  bill_photo_path?: string | null;
  paid_by_cash_box: number; // 1 or 0
  added_to_shop_expenses: number; // 1 or 0
  reimbursed_in_salary: number; // 1 or 0
  flag?: ExpenseFlag;
  status: ExpenseStatus;
  approved_by?: number | null;
  approved_by_name?: string | null;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export type IncentiveType = 'sales_target' | 'attendance_target' | 'speed_target' | 'manual';

export interface IncentiveRule {
  id: number;
  store_id: number;
  rule_name: string;
  rule_type: IncentiveType;
  target_value: number;
  reward_amount_paise: number;
  description?: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeIncentive {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  incentive_type: 'rule_based' | 'manual';
  rule_id?: number | null;
  rule_name?: string | null;
  amount_paise: number;
  incentive_date: string;
  month_year: string;
  reason: string;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeOvertime {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  date: string;
  normal_hours: number;
  ot_hours: number;
  ot_rate_paise: number;
  computed_amount_paise: number;
  notes?: string | null;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export type DeductionType = 
  | 'Advance Recovery' 
  | 'Uniform / Equipment' 
  | 'Loss / Damage Penalty' 
  | 'Late / Disciplinary Fine' 
  | 'Loan Recovery' 
  | 'Unpaid Leave'
  | 'Damage Deduction'
  | 'Employee Expense Recovery'
  | 'Other';

export interface EmployeeDeduction {
  id: number;
  store_id: number;
  employee_id: number;
  emp_code?: string;
  full_name?: string;
  department?: string;
  deduction_type: DeductionType;
  advance_id?: number | null;
  advance_original_amount_paise?: number | null;
  amount_paise: number;
  deduction_date: string;
  reason: string;
  approved_by?: number | null;
  approved_by_name?: string | null;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

// Phase 3: Payroll Engine, Statements, Slips, Payments, Audit, Reversals, Locks, Reports

export type PayrollStatus = 'Draft' | 'Approved' | 'Paid' | 'Locked';

export interface PayrollPeriodInput {
  periodType: 'monthly' | 'weekly' | 'custom' | 'relieving';
  monthYear?: string; // 'YYYY-MM'
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string;   // 'YYYY-MM-DD'
  employeeId?: number; // for relieving or single employee
  relievingReason?: string;
  forceRecalculate?: boolean;
}

export interface PayrollRun {
  id: number;
  store_id: number;
  month_year: string;
  start_date?: string | null;
  end_date?: string | null;
  cycle_type?: string;
  status: PayrollStatus;
  total_employees: number;
  total_gross_paise: number;
  total_deductions_paise: number;
  total_net_paise: number;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  locked_by?: number | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  notes?: string | null;
  created_by?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: number;
  payroll_run_id: number;
  store_id: number;
  employee_id: number;
  emp_code: string;
  full_name: string;
  role: string;
  department: string;
  salary_type: PayType;
  month_year: string;
  start_date?: string | null;
  end_date?: string | null;
  cycle_type?: string;
  total_days_in_month: number;
  worked_days: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  half_days: number;
  overtime_hours: number;
  basic_salary_paise: number;
  fixed_allowances_paise: number;
  fixed_allowances_breakdown_json?: string;
  fixed_allowances_breakdown?: FixedAllowance[];
  overtime_amount_paise: number;
  incentive_amount_paise: number;
  reimbursable_expenses_paise: number;
  gross_salary_paise: number;
  advance_recovery_paise: number;
  unpaid_leave_deduction_paise: number;
  other_deductions_paise: number;
  total_deductions_paise: number;
  net_salary_paise: number;
  is_overridden: number;
  original_net_salary_paise?: number | null;
  override_reason?: string | null;
  status: PayrollStatus;
  payment_method?: 'cash' | 'bank' | 'upi' | 'cheque' | null;
  payment_date?: string | null;
  payment_reference?: string | null;
  paid_by?: number | null;
  paid_by_name?: string | null;
  payment_id?: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export interface HRAuditLog {
  id: number;
  store_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_value_json?: string | null;
  new_value_json?: string | null;
  reason: string;
  performed_by: number;
  performed_by_name?: string | null;
  created_at: string;
}

export interface EmployeeSummary360 {
  employee: Employee;
  salary_structure: SalaryStructure | null;
  active_advances_count: number;
  total_advances_outstanding_paise: number;
  this_month: {
    month_year: string;
    worked_days: number;
    present_days: number;
    absent_days: number;
    paid_leave_days: number;
    unpaid_leave_days: number;
    overtime_hours: number;
    overtime_amount_paise: number;
    incentives_amount_paise: number;
    reimbursable_expenses_paise: number;
    deductions_paise: number;
    estimated_net_paise: number;
  };
  recent_payrolls: PayrollItem[];
  recent_leaves?: EmployeeLeave[];
  recent_advances?: EmployeeAdvance[];
  ledger_balance_paise: number;
}

export interface HRPayrollReportSummary {
  month_year: string;
  total_employees: number;
  paid_count: number;
  unpaid_count: number;
  total_gross_paise: number;
  total_basic_paise: number;
  total_allowances_paise: number;
  total_ot_paise: number;
  total_incentives_paise: number;
  total_reimbursements_paise: number;
  total_advance_recoveries_paise: number;
  total_unpaid_deductions_paise: number;
  total_other_deductions_paise: number;
  total_deductions_paise: number;
  total_net_payout_paise: number;
}
