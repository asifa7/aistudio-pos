-- ============================================================
-- 032_fix_missing_tables_and_columns.sql
-- Systemic Schema Fix: inventory_metadata, customer_payments, reconciliations, sales return resolution
-- ============================================================

-- 1. Create inventory_metadata table for key-value system settings & audit timestamps
CREATE TABLE IF NOT EXISTS inventory_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create customer_payments table matching CustomerPaymentRepository interface
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    method TEXT NOT NULL CHECK(method IN ('cash', 'upi', 'card', 'cheque', 'bank_transfer')),
    reference_number TEXT,
    cheque_number TEXT,
    cheque_date TEXT,
    bank_name TEXT,
    payment_date DATE NOT NULL DEFAULT (date('now')),
    notes TEXT,
    is_advance INTEGER DEFAULT 0 NOT NULL CHECK(is_advance IN (0, 1)),
    is_allocated INTEGER DEFAULT 0 NOT NULL CHECK(is_allocated IN (0, 1)),
    unallocated_paise INTEGER NOT NULL DEFAULT 0,
    received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);

-- 3. Create daily_inventory_reconciliations table for daily stock discrepancy tracking
CREATE TABLE IF NOT EXISTS daily_inventory_reconciliations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reconciliation_date DATE NOT NULL,
    product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    expected_quantity_grams INTEGER,
    expected_quantity_units INTEGER,
    expected_quantity_count REAL,
    actual_quantity_grams INTEGER,
    actual_quantity_units INTEGER,
    actual_quantity_count REAL,
    discrepancy_grams INTEGER,
    discrepancy_units INTEGER,
    discrepancy_count REAL,
    status TEXT NOT NULL DEFAULT 'flagged' CHECK(status IN ('flagged', 'resolved_wastage', 'resolved_bill', 'dismissed')),
    action_taken TEXT,
    notes TEXT,
    flagged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_date ON daily_inventory_reconciliations(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_variant ON daily_inventory_reconciliations(product_variant_id);

-- 4. Add resolution_type and replacement tracking columns to sales_returns & sales_return_items
ALTER TABLE sales_returns ADD COLUMN resolution_type TEXT DEFAULT 'refunded' CHECK(resolution_type IN ('refunded', 'replaced'));
ALTER TABLE sales_returns ADD COLUMN replacement_variant_id INTEGER REFERENCES product_variants(id);
ALTER TABLE sales_returns ADD COLUMN replacement_quantity REAL;

ALTER TABLE sales_return_items ADD COLUMN resolution_type TEXT DEFAULT 'refunded' CHECK(resolution_type IN ('refunded', 'replaced'));
ALTER TABLE sales_return_items ADD COLUMN replacement_variant_id INTEGER REFERENCES product_variants(id);
