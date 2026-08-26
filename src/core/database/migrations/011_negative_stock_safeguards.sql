-- 011_negative_stock_safeguards.sql

-- 1. Create a table to track legacy negative stock that was zeroed out
CREATE TABLE IF NOT EXISTS legacy_negative_stock_review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    original_quantity_grams INTEGER,
    original_quantity_units INTEGER,
    reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconciled INTEGER DEFAULT 0,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
);

-- 2. Migrate existing negative stock rows to 0 and log them
INSERT INTO legacy_negative_stock_review (product_variant_id, original_quantity_grams, original_quantity_units)
SELECT product_variant_id, quantity_grams, quantity_units
FROM stock_ledger
WHERE (quantity_grams < 0 OR quantity_units < 0);

UPDATE stock_ledger
SET quantity_grams = CASE WHEN quantity_grams < 0 THEN 0 ELSE quantity_grams END,
    quantity_units = CASE WHEN quantity_units < 0 THEN 0 ELSE quantity_units END
WHERE quantity_grams < 0 OR quantity_units < 0;

-- 3. Add triggers to strictly enforce >= 0
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
