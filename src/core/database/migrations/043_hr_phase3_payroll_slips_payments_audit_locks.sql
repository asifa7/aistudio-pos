-- Migration 043: HR & Payroll Phase 3: Payroll Engine, Statements, Slips, Payments, Audit Logs, Reversals, Locks

-- 1. Payroll Runs (Monthly Master Batch)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  month_year TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
  status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Approved', 'Paid', 'Locked'
  total_employees INTEGER NOT NULL DEFAULT 0,
  total_gross_paise INTEGER NOT NULL DEFAULT 0,
  total_deductions_paise INTEGER NOT NULL DEFAULT 0,
  total_net_paise INTEGER NOT NULL DEFAULT 0,
  approved_by INTEGER,
  approved_at DATETIME,
  locked_by INTEGER,
  locked_at DATETIME,
  notes TEXT,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month ON payroll_runs(month_year);

-- 2. Payroll Items (Per Employee Monthly Payroll Breakdown)
CREATE TABLE IF NOT EXISTS payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id INTEGER REFERENCES payroll_runs(id),
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  month_year TEXT NOT NULL, -- 'YYYY-MM'
  salary_type TEXT NOT NULL DEFAULT 'Monthly', -- 'Monthly', 'Daily', 'Hourly'
  total_days_in_month INTEGER NOT NULL DEFAULT 30,
  worked_days NUMERIC NOT NULL DEFAULT 0,
  present_days NUMERIC NOT NULL DEFAULT 0,
  paid_leave_days NUMERIC NOT NULL DEFAULT 0,
  unpaid_leave_days NUMERIC NOT NULL DEFAULT 0,
  half_days NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  basic_salary_paise INTEGER NOT NULL DEFAULT 0,
  fixed_allowances_paise INTEGER NOT NULL DEFAULT 0,
  fixed_allowances_breakdown_json TEXT,
  overtime_amount_paise INTEGER NOT NULL DEFAULT 0,
  incentive_amount_paise INTEGER NOT NULL DEFAULT 0,
  reimbursable_expenses_paise INTEGER NOT NULL DEFAULT 0,
  gross_salary_paise INTEGER NOT NULL DEFAULT 0,
  advance_recovery_paise INTEGER NOT NULL DEFAULT 0,
  unpaid_leave_deduction_paise INTEGER NOT NULL DEFAULT 0,
  other_deductions_paise INTEGER NOT NULL DEFAULT 0,
  total_deductions_paise INTEGER NOT NULL DEFAULT 0,
  net_salary_paise INTEGER NOT NULL DEFAULT 0,
  is_overridden INTEGER NOT NULL DEFAULT 0,
  original_net_salary_paise INTEGER,
  override_reason TEXT,
  status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Approved', 'Paid', 'Locked'
  payment_method TEXT, -- 'cash', 'bank', 'upi', 'cheque'
  payment_date DATE,
  payment_reference TEXT,
  paid_by INTEGER,
  payment_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, month_year, is_active)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_emp_month ON payroll_items(employee_id, month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_status ON payroll_items(status);

-- 3. HR Audit Logs (Tracking Overrides, Reversals, Approvals, Status Changes)
CREATE TABLE IF NOT EXISTS hr_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL, -- 'payroll_run', 'payroll_item', 'attendance', 'advance', 'deduction', 'expense', 'incentive', 'salary_structure', 'employee'
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'OVERRIDE', 'APPROVE', 'PAY', 'REVERSE', 'LOCK', 'REOPEN'
  old_value_json TEXT,
  new_value_json TEXT,
  reason TEXT NOT NULL,
  performed_by INTEGER NOT NULL,
  performed_by_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hr_audit_entity ON hr_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_created ON hr_audit_logs(created_at);

-- 4. Payroll Payment Reversals
CREATE TABLE IF NOT EXISTS payroll_reversals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  payroll_item_id INTEGER NOT NULL REFERENCES payroll_items(id),
  reversed_amount_paise INTEGER NOT NULL,
  reversal_reason TEXT NOT NULL,
  reversed_by INTEGER NOT NULL,
  reversed_by_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_reversals_item ON payroll_reversals(payroll_item_id);
