-- ============================================================
-- 031_live_dual_and_processed_cuts.sql
-- Live/Whole Animal Dual-Unit Stock & Processed Cuts Lockdown
-- ============================================================
-- @no-transaction
BEGIN TRANSACTION;

PRAGMA defer_foreign_keys = ON;

-- 1. Add dual-unit columns to product_stock_batches and yield_processing_runs if not present
ALTER TABLE product_stock_batches ADD COLUMN initial_count REAL;
ALTER TABLE product_stock_batches ADD COLUMN current_count REAL;
ALTER TABLE yield_processing_runs ADD COLUMN input_count REAL;
ALTER TABLE product_variants ADD COLUMN is_processed_cut INTEGER DEFAULT 0 CHECK(is_processed_cut IN (0, 1));

-- 2. Recreate stock_ledger to remove restrictive single-unit CHECK constraint and add count columns
CREATE TABLE IF NOT EXISTS stock_ledger_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER UNIQUE NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    quantity_count REAL DEFAULT 0,
    safety_threshold_grams INTEGER DEFAULT 5000,
    safety_threshold_units INTEGER DEFAULT 10,
    safety_threshold_count REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

INSERT INTO stock_ledger_new (id, product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units, updated_at)
SELECT id, product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units, updated_at
FROM stock_ledger;

DROP TABLE stock_ledger;
ALTER TABLE stock_ledger_new RENAME TO stock_ledger;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_variant ON stock_ledger(product_variant_id);

-- 4. Recreate stock_adjustments to remove single-unit CHECK constraint
CREATE TABLE IF NOT EXISTS stock_adjustments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    adjustment_type TEXT NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    quantity_count REAL,
    reason TEXT NOT NULL,
    adjusted_by INTEGER NOT NULL,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY(adjusted_by) REFERENCES users(id)
);

INSERT INTO stock_adjustments_new (id, product_variant_id, adjustment_type, quantity_grams, quantity_units, quantity_count, reason, adjusted_by, user_id, created_at)
SELECT id, product_variant_id, adjustment_type, quantity_grams, quantity_units, NULL, reason, adjusted_by, user_id, created_at
FROM stock_adjustments;

DROP TABLE stock_adjustments;
ALTER TABLE stock_adjustments_new RENAME TO stock_adjustments;

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_variant ON stock_adjustments(product_variant_id);

-- 5. Recreate products table to support unit_type = 'live_dual' without CHECK failure
DROP VIEW IF EXISTS v_customer_purchase_history;

CREATE TABLE IF NOT EXISTS products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK(unit_type IN ('weight', 'piece', 'live_dual')),
    category TEXT NOT NULL,
    is_processed_cut INTEGER DEFAULT 0 CHECK(is_processed_cut IN (0, 1)),
    is_active INTEGER DEFAULT 1 NOT NULL CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products_new (id, product_code, name, unit_type, category, is_processed_cut, is_active, created_at, updated_at)
SELECT id, product_code, name, unit_type, category, 0, is_active, created_at, updated_at
FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

ALTER TABLE invoices ADD COLUMN total_amount_paise INTEGER DEFAULT 0;

CREATE VIEW IF NOT EXISTS v_customer_purchase_history AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  i.id as invoice_id,
  i.invoice_number,
  i.created_at as invoice_date,
  i.total_amount_paise,
  i.payment_status,
  COUNT(ii.id) as total_items
FROM customers c
JOIN invoices i ON i.customer_id = c.id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id;

COMMIT;
BEGIN TRANSACTION;

-- 6. Apply Product Classifications based on catalog
-- Live / Whole Animals (live_dual)
UPDATE products SET unit_type = 'live_dual', is_processed_cut = 0 WHERE name IN ('Fresh Chicken', 'Country Chicken', 'Quails', 'Premium Mutton', 'mutton');

-- Processed Cuts (is_processed_cut = 1)
-- Update variants or products that represent processed cut items
UPDATE products SET is_processed_cut = 1 WHERE name LIKE '%Cut%' OR name LIKE '%Boneless%' OR name LIKE '%Wings%' OR name LIKE '%Chops%' OR name LIKE '%Keema%';

-- Ensure specific variants are classified appropriately
UPDATE product_variants SET is_processed_cut = 1 WHERE variant_name LIKE '%Boneless%' OR variant_name LIKE '%Cut%' OR variant_name LIKE '%Skinless%' OR variant_name LIKE '%Chops%' OR variant_name LIKE '%Keema%' OR variant_name LIKE '%Steaks%';

COMMIT;
