-- Migration 029: Systemic Database Schema Repair
-- Ensures all columns, indices, and tables expected across all modules exist cleanly

-- 1. Safely add fifo_cogs_paise to invoice_items
ALTER TABLE invoice_items ADD COLUMN fifo_cogs_paise INTEGER DEFAULT 0;

-- 2. Ensure stock_ledger uniquely constraints product_variant_id for UPSERT operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_ledger_variant_unique ON stock_ledger(product_variant_id);

-- 3. Re-create negative stock triggers
DROP TRIGGER IF EXISTS prevent_negative_stock_insert;
DROP TRIGGER IF EXISTS prevent_negative_stock_update;

CREATE TRIGGER IF NOT EXISTS prevent_negative_stock_insert
BEFORE INSERT ON stock_ledger
FOR EACH ROW
WHEN (NEW.quantity_grams IS NOT NULL AND NEW.quantity_grams < 0) OR (NEW.quantity_units IS NOT NULL AND NEW.quantity_units < 0)
BEGIN
  SELECT RAISE(ABORT, 'Stock cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS prevent_negative_stock_update
BEFORE UPDATE ON stock_ledger
FOR EACH ROW
WHEN (NEW.quantity_grams IS NOT NULL AND NEW.quantity_grams < 0) OR (NEW.quantity_units IS NOT NULL AND NEW.quantity_units < 0)
BEGIN
  SELECT RAISE(ABORT, 'Stock cannot be negative');
END;
