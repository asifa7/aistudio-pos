-- Enterprise Core Orchestration & Business Engines Migration

-- 1. Journal Vouchers & GL Double-Entry Posting Engine
CREATE TABLE IF NOT EXISTS journal_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    voucher_number TEXT NOT NULL UNIQUE,
    voucher_date DATE NOT NULL,
    voucher_type TEXT NOT NULL, -- Sales, Purchase, Payroll, Expense, Refund, Adjustment
    reference_id TEXT,
    narration TEXT NOT NULL,
    total_debit_paise INTEGER NOT NULL DEFAULT 0,
    total_credit_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Posted',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

CREATE TABLE IF NOT EXISTS journal_voucher_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    account_code TEXT NOT NULL, -- 1001 Cash, 1002 Bank, 4001 Sales Revenue, 5001 COGS, 1201 Inventory, 6001 Expenses
    account_name TEXT NOT NULL,
    debit_paise INTEGER NOT NULL DEFAULT 0,
    credit_paise INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (voucher_id) REFERENCES journal_vouchers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jv_entries_account ON journal_voucher_entries(account_code);

-- 2. Inventory Cost Lots (FIFO & Weighted Average Costing)
CREATE TABLE IF NOT EXISTS inventory_cost_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    variant_id INTEGER NOT NULL,
    purchase_invoice_id INTEGER,
    received_date DATE NOT NULL,
    initial_qty REAL NOT NULL,
    remaining_qty REAL NOT NULL,
    unit_cost_paise INTEGER NOT NULL,
    is_exhausted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_lots_variant ON inventory_cost_lots(variant_id, is_exhausted);

-- 3. Feature Flags Manager
CREATE TABLE IF NOT EXISTS feature_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flag_key TEXT NOT NULL UNIQUE,
    flag_name TEXT NOT NULL,
    description TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO feature_flags (flag_key, flag_name, description, is_enabled) VALUES
('ENABLE_CRM', 'Customer CRM & Loyalty', 'Enable customer CRM profiles, wallet, and loyalty points', 1),
('ENABLE_BOM', 'Recipe & Bill of Materials', 'Enable BOM inventory deductions for combos and cooked items', 1),
('ENABLE_MARKET_PRICING', 'Daily Poultry & Egg Market Rates', 'Auto-update POS rates based on daily wholesale market prices', 1),
('ENABLE_MULTI_STORE', 'Multi-Branch Readiness', 'Enable multi-location store hierarchy and transfers', 1),
('ENABLE_APPROVALS', 'Configurable Approval Chains', 'Require manager authorization for large expenses/refunds', 1);

-- 4. Business Rules Engine
CREATE TABLE IF NOT EXISTS business_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_key TEXT NOT NULL UNIQUE,
    rule_name TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    action_type TEXT NOT NULL, -- Require_Approval, Require_Manager_PIN, Warn_User
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO business_rules (rule_key, rule_name, threshold_value, action_type) VALUES
('EXPENSE_APPROVAL_THRESHOLD', 'Expense Manager Approval Limit (₹)', 5000.0, 'Require_Approval'),
('REFUND_PIN_THRESHOLD', 'Refund Manager PIN Limit (₹)', 2000.0, 'Require_Manager_PIN'),
('MAX_DISCOUNT_PERCENT', 'Maximum Cashier Discount Limit (%)', 10.0, 'Require_Approval');

-- 5. State Machine Audit Logs
CREATE TABLE IF NOT EXISTS state_machine_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- Purchase_Order, Expense, Leave, Refund
    entity_id INTEGER NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    performed_by INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Global Search Index Cache
CREATE TABLE IF NOT EXISTS global_search_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- Product, Customer, Supplier, Invoice, Expense, Employee
    entity_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    search_vector TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_global_search_vec ON global_search_index(search_vector);
