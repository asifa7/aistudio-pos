-- Migration 041: HR & Payroll Phase 1 - Employee Master, Salary Structure, Attendance, Leave Management

-- 1. Ensure employees table has modern fields
ALTER TABLE employees ADD COLUMN salary_type TEXT DEFAULT 'Monthly';
ALTER TABLE employees ADD COLUMN photo_url TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE employees ADD COLUMN documents_notes TEXT;

-- 2. Employee Salary Structures Table (Rules separate from profile)
CREATE TABLE IF NOT EXISTS employee_salary_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL UNIQUE,
    pay_type TEXT NOT NULL DEFAULT 'Monthly' CHECK(pay_type IN ('Monthly', 'Daily', 'Hourly')),
    basic_salary_paise INTEGER NOT NULL DEFAULT 0,
    fixed_allowances_json TEXT NOT NULL DEFAULT '[]',
    overtime_rate_paise INTEGER NOT NULL DEFAULT 0,
    incentive_rule_ref TEXT,
    attendance_based_salary INTEGER NOT NULL DEFAULT 0,
    deduction_rules_json TEXT NOT NULL DEFAULT '[]',
    effective_from DATE DEFAULT (date('now')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emp_salary_struct_emp ON employee_salary_structures(employee_id);

-- 3. Configurable HR Roles & Departments
CREATE TABLE IF NOT EXISTS hr_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO hr_roles (name, description) VALUES
    ('Cashier', 'Front desk billing & customer service'),
    ('Master Cutter', 'Expert meat cutting and dressing'),
    ('Helper', 'General assistance and packaging'),
    ('Store Manager', 'Branch operations & supervision'),
    ('Accountant', 'Books, vouchers & reconciliation'),
    ('Cleaner', 'Shop hygiene and sanitation'),
    ('Delivery Boy', 'Customer order dispatch and delivery');

-- 4. Configurable Leave Types
CREATE TABLE IF NOT EXISTS hr_leave_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    default_days_per_year INTEGER NOT NULL DEFAULT 12,
    is_paid INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO hr_leave_types (name, code, default_days_per_year, is_paid) VALUES
    ('Casual Leave', 'CL', 12, 1),
    ('Sick Leave', 'SL', 6, 1),
    ('Annual Leave', 'AL', 15, 1),
    ('Unpaid Leave', 'UL', 0, 0),
    ('Emergency Leave', 'EL', 3, 1);

-- 5. Add columns to employee_leaves if missing
ALTER TABLE employee_leaves ADD COLUMN leave_type_id INTEGER;
ALTER TABLE employee_leaves ADD COLUMN is_paid INTEGER DEFAULT 1;
ALTER TABLE employee_leaves ADD COLUMN total_days REAL DEFAULT 1;
ALTER TABLE employee_leaves ADD COLUMN rejection_reason TEXT;

-- 6. Payroll Month Locks Table (Phase 3 Preparation & Lock Check)
CREATE TABLE IF NOT EXISTS hr_payroll_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_year TEXT UNIQUE NOT NULL, -- Format: YYYY-MM
    is_locked INTEGER NOT NULL DEFAULT 0,
    locked_at DATETIME,
    locked_by INTEGER,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (locked_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_locks_month ON hr_payroll_locks(month_year);

-- 7. Seed Salary Structures for existing employees if any exist
INSERT OR IGNORE INTO employee_salary_structures (employee_id, pay_type, basic_salary_paise, fixed_allowances_json, overtime_rate_paise, attendance_based_salary)
SELECT 
    id, 
    'Monthly', 
    COALESCE(basic_salary_paise, 2000000), 
    '[]', 
    0, 
    0 
FROM employees 
WHERE id NOT IN (SELECT employee_id FROM employee_salary_structures);
