-- Migration 033: Systemic Schema Audit Fix (trimmed — dead-code-only items removed)
-- Fixes ONLY tables/columns/indexes that are referenced by real, live application code.

-- 1. Create migrations table for migration engine compatibility
-- (migrations.ts self-creates this, but including as safety net)
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add missing columns to users table (used by auth_service, hr_service)
ALTER TABLE users ADD COLUMN emp_code TEXT;
ALTER TABLE users ADD COLUMN pin_code TEXT;
ALTER TABLE users ADD COLUMN full_name TEXT;

-- 3. Add missing columns to suppliers table (used by supplier_repository, purchase_repository)
ALTER TABLE suppliers ADD COLUMN name TEXT;
ALTER TABLE suppliers ADD COLUMN contact TEXT;
ALTER TABLE suppliers ADD COLUMN contact_person TEXT;

-- 4. Add missing columns to customers table (used by repositories.ts)
ALTER TABLE customers ADD COLUMN current_balance_paise INTEGER DEFAULT 0;

-- 5. Add missing columns to product_variants table (used by demand_forecasting_service)
ALTER TABLE product_variants ADD COLUMN safety_threshold_grams INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN safety_threshold_units INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN unit_type TEXT DEFAULT 'weight';

-- 6. Add invoice_date column to invoices (used by v_customer_purchase_history view)
ALTER TABLE invoices ADD COLUMN invoice_date DATETIME;

-- 7. Add missing columns to invoice_items table
ALTER TABLE invoice_items ADD COLUMN line_tax_paise INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 8. Add UNIQUE index on credit_note_sequences(year) for ON CONFLICT(year) upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_note_sequences_year ON credit_note_sequences(year);

-- 9. Recreate v_customer_purchase_history view safely
DROP VIEW IF EXISTS v_customer_purchase_history;
CREATE VIEW v_customer_purchase_history AS
SELECT 
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.total_paise,
  i.total_paise AS total_amount_paise,
  i.payment_status,
  COALESCE(i.invoice_date, i.created_at) AS invoice_date
FROM invoices i;
