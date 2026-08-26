-- Migration 042: HR & Payroll Phase 2: Employee Ledger, Advances, Expenses, Incentives, Overtime, Deductions

-- 1. Employee Ledger (Master Source of Truth)
CREATE TABLE IF NOT EXISTS employee_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- 'advance_disbursement', 'advance_recovery', 'expense_reimbursement', 'expense_deduction', 'company_expense', 'incentive', 'overtime', 'deduction', 'salary_credit', 'salary_payout'
  debit_paise INTEGER NOT NULL DEFAULT 0, -- Employee owes / Advance given / Deductions
  credit_paise INTEGER NOT NULL DEFAULT 0, -- Shop owes / Earnings / Incentives / OT / Reimbursements
  running_balance_paise INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT, -- 'employee_advances', 'employee_expenses', 'employee_incentives', 'employee_overtime', 'employee_deductions', 'payroll'
  reference_id INTEGER,
  reference_number TEXT,
  description TEXT NOT NULL,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_ledger_emp ON employee_ledger(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_date ON employee_ledger(entry_date);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_ref ON employee_ledger(reference_type, reference_id);

-- 2. Employee Advances
CREATE TABLE IF NOT EXISTS employee_advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount_paise INTEGER NOT NULL,
  advance_date DATE NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank', 'upi'
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Partially_Recovered', 'Fully_Recovered'
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_advances_emp ON employee_advances(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_advances_date ON employee_advances(advance_date);

-- 3. Employee Expenses (paid by the shop, for the employee)
CREATE TABLE IF NOT EXISTS employee_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  expense_date DATE NOT NULL,
  amount_paise INTEGER NOT NULL,
  category TEXT NOT NULL, -- 'Travel', 'Food', 'Uniform', 'Medical Reimbursement', 'Phone Recharge', 'Other'
  description TEXT NOT NULL,
  flag TEXT NOT NULL, -- 'Reimbursable', 'Salary Deduction', 'Company Expense'
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'Approved', -- 'Pending', 'Approved', 'Rejected'
  approved_by INTEGER,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_expenses_emp ON employee_expenses(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_expenses_date ON employee_expenses(expense_date);

-- 4. Incentive Rules
CREATE TABLE IF NOT EXISTS employee_incentive_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'sales_target', 'attendance_target', 'cutting_yield', 'custom'
  target_value NUMERIC NOT NULL,
  reward_amount_paise INTEGER NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default incentive rules
INSERT INTO employee_incentive_rules (store_id, rule_name, rule_type, target_value, reward_amount_paise, description)
VALUES 
  (1, 'Monthly Sales > ₹5 Lakhs', 'sales_target', 50000000, 200000, 'Reward for store sales exceeding ₹5,00,000 in a month'),
  (1, '100% Perfect Attendance', 'attendance_target', 26, 100000, 'Zero absenteeism bonus for 26+ full working days in a month');

-- 5. Employee Incentives (Manual & Rule-evaluated)
CREATE TABLE IF NOT EXISTS employee_incentives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  incentive_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'rule_based'
  rule_id INTEGER REFERENCES employee_incentive_rules(id),
  amount_paise INTEGER NOT NULL,
  incentive_date DATE NOT NULL,
  month_year TEXT, -- 'YYYY-MM'
  reason TEXT NOT NULL,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_incentives_emp ON employee_incentives(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_incentives_month ON employee_incentives(month_year);

-- 6. Employee Overtime Records
CREATE TABLE IF NOT EXISTS employee_overtime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,
  normal_hours NUMERIC NOT NULL DEFAULT 8,
  ot_hours NUMERIC NOT NULL,
  ot_rate_paise INTEGER NOT NULL,
  computed_amount_paise INTEGER NOT NULL, -- round(ot_hours * ot_rate_paise)
  notes TEXT,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_overtime_emp ON employee_overtime(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_overtime_date ON employee_overtime(date);

-- 7. Employee Deductions
CREATE TABLE IF NOT EXISTS employee_deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  deduction_type TEXT NOT NULL, -- 'Advance Recovery', 'Unpaid Leave', 'Loan Recovery', 'Damage Deduction', 'Employee Expense Recovery', 'Other'
  advance_id INTEGER REFERENCES employee_advances(id),
  amount_paise INTEGER NOT NULL,
  deduction_date DATE NOT NULL,
  reason TEXT NOT NULL, -- Mandatory
  approved_by INTEGER,
  approved_by_name TEXT,
  created_by INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_deductions_emp ON employee_deductions(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_deductions_adv ON employee_deductions(advance_id);
CREATE INDEX IF NOT EXISTS idx_employee_deductions_date ON employee_deductions(deduction_date);
