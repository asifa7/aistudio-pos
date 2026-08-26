-- Enterprise ERP & POS Expansion Migration
-- Adds multi-store readiness, HR, Payroll, Attendance, Leaves, Performance,
-- Cash Box Shifts, Expense Manager, Daily Chicken & Egg Prices, Customer CRM,
-- Inventory Batches, Accounting Ledgers, and Audit Logging.

-- 1. Stores (Multi-Store Readiness)
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME
);

INSERT OR IGNORE INTO stores (id, code, name, address, phone, is_active)
VALUES (1, 'STR-00001', 'Main Meat Shop Store', '123 Market Square', '+91 98765 43210', 1);

-- 2. Employee Profiles
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    emp_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    gender TEXT,
    dob DATE,
    mobile TEXT NOT NULL,
    email TEXT,
    address TEXT,
    emergency_contact TEXT,
    joining_date DATE NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CASHIER',
    employment_type TEXT NOT NULL DEFAULT 'Full-Time',
    shift TEXT DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'Active',
    aadhaar_number TEXT,
    pan_number TEXT,
    bank_account TEXT,
    ifsc_code TEXT,
    upi_id TEXT,
    basic_salary_paise INTEGER NOT NULL DEFAULT 0,
    hra_paise INTEGER NOT NULL DEFAULT 0,
    allowance_paise INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- 3. Employee Attendance
CREATE TABLE IF NOT EXISTS employee_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    employee_id INTEGER NOT NULL,
    date DATE NOT NULL,
    clock_in DATETIME,
    clock_out DATETIME,
    status TEXT NOT NULL DEFAULT 'Present', -- Present, Absent, Late, Half_Day, Holiday, Weekly_Off
    working_hours REAL DEFAULT 0,
    overtime_hours REAL DEFAULT 0,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_emp_att_date ON employee_attendance(date);

-- 4. Employee Leaves
CREATE TABLE IF NOT EXISTS employee_leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    employee_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL, -- Sick, Casual, Paid, Emergency, Unpaid
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    approved_by INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 5. Employee Payrolls
CREATE TABLE IF NOT EXISTS employee_payrolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    employee_id INTEGER NOT NULL,
    month_year TEXT NOT NULL, -- YYYY-MM
    basic_paise INTEGER NOT NULL DEFAULT 0,
    hra_paise INTEGER NOT NULL DEFAULT 0,
    allowance_paise INTEGER NOT NULL DEFAULT 0,
    incentive_paise INTEGER NOT NULL DEFAULT 0,
    bonus_paise INTEGER NOT NULL DEFAULT 0,
    overtime_paise INTEGER NOT NULL DEFAULT 0,
    pf_deduction_paise INTEGER NOT NULL DEFAULT 0,
    esi_deduction_paise INTEGER NOT NULL DEFAULT 0,
    tax_deduction_paise INTEGER NOT NULL DEFAULT 0,
    advance_deduction_paise INTEGER NOT NULL DEFAULT 0,
    net_salary_paise INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Paid
    paid_at DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, month_year)
);

-- 6. POS Sessions & Shift Closings
CREATE TABLE IF NOT EXISTS pos_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    cashier_id INTEGER NOT NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_cash_paise INTEGER NOT NULL DEFAULT 0,
    closing_cash_paise INTEGER,
    expected_cash_paise INTEGER,
    variance_paise INTEGER,
    status TEXT NOT NULL DEFAULT 'Open', -- Open, Closed, Reconciled
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME
);

-- 7. Store Cash Box (Transactions)
CREATE TABLE IF NOT EXISTS store_cash_box (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    session_id INTEGER,
    type TEXT NOT NULL, -- Cash_In, Cash_Out, Petty_Cash, Cash_Transfer, Adjustment
    amount_paise INTEGER NOT NULL,
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    performed_by INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES pos_sessions(id)
);

-- 8. Expense Categories & Expenses
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO expense_categories (name) VALUES 
('Electricity'), ('Rent'), ('Salary'), ('Fuel'), ('Maintenance'), 
('Transport'), ('Packaging'), ('Internet'), ('Miscellaneous');

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER NOT NULL,
    vendor_name TEXT,
    amount_paise INTEGER NOT NULL,
    gst_paise INTEGER DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    expense_date DATE NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Approved', -- Pending, Approved, Rejected
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

-- 9. Daily Chicken & Egg Price Manager
CREATE TABLE IF NOT EXISTS daily_market_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    product_name TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT 'Standard',
    market_rate_paise INTEGER NOT NULL,
    wholesale_rate_paise INTEGER NOT NULL,
    retail_rate_paise INTEGER NOT NULL,
    selling_rate_paise INTEGER NOT NULL,
    expected_margin_percent REAL DEFAULT 15.0,
    supplier_name TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    UNIQUE(date, product_name, grade)
);

CREATE TABLE IF NOT EXISTS egg_market_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    egg_type TEXT NOT NULL, -- Country, Farm, Brown, Duck
    tray_price_paise INTEGER NOT NULL, -- 30 eggs tray
    single_price_paise INTEGER NOT NULL,
    wholesale_price_paise INTEGER NOT NULL,
    retail_price_paise INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME,
    UNIQUE(date, egg_type)
);

-- 10. Accounting Daily Ledger
CREATE TABLE IF NOT EXISTS accounting_daily_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL,
    account_type TEXT NOT NULL, -- Cash, Sales, Purchase, Expense, Supplier, Customer, Employee_Advance, Variance
    reference_id TEXT,
    description TEXT NOT NULL,
    debit_paise INTEGER NOT NULL DEFAULT 0,
    credit_paise INTEGER NOT NULL DEFAULT 0,
    balance_paise INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_acc_ledger_type ON accounting_daily_ledger(account_type, date);

-- 11. Enterprise Audit Logs
CREATE TABLE IF NOT EXISTS enterprise_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ent_audit_mod ON enterprise_audit_logs(module, action);
