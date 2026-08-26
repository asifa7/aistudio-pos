-- 003_inventory_ledger.sql

-- Create Stock Ledger Table
CREATE TABLE IF NOT EXISTS stock_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER UNIQUE NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    safety_threshold_grams INTEGER DEFAULT 5000, -- 5kg
    safety_threshold_units INTEGER DEFAULT 10,   -- 10 pcs
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    ),
    CHECK(
        (safety_threshold_grams IS NOT NULL AND safety_threshold_units IS NULL) OR
        (safety_threshold_grams IS NULL AND safety_threshold_units IS NOT NULL)
    )
);

-- Create Stock Adjustments Table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('stock_in', 'stock_out', 'wastage', 'damage')),
    quantity_grams INTEGER,
    quantity_units INTEGER,
    reason TEXT NOT NULL,
    adjusted_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY(adjusted_by) REFERENCES users(id),
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    )
);

-- Create Stock Transactions Table
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale_deduction', 'sale_reversal', 'manual_adjustment')),
    quantity_grams INTEGER,
    quantity_units INTEGER,
    reference_id INTEGER NOT NULL, -- references invoice_id or adjustment_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    )
);

-- Add Indexings for inventory
CREATE INDEX IF NOT EXISTS idx_stock_ledger_variant ON stock_ledger(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_variant ON stock_transactions(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_variant ON stock_adjustments(product_variant_id);

-- Seed Initial Stock Levels for existing variants (set initial stock to 50kg for weight and 100 units for pieces)
-- Chicken (1, 2, 3, 4) - weight
INSERT INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units) VALUES
(1, 50000, NULL, 5000, NULL),
(2, 50000, NULL, 5000, NULL),
(3, 50000, NULL, 5000, NULL),
(4, 50000, NULL, 5000, NULL)
ON CONFLICT(product_variant_id) DO NOTHING;

-- Mutton (5, 6, 7) - weight
INSERT INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units) VALUES
(5, 30000, NULL, 3000, NULL),
(6, 30000, NULL, 3000, NULL),
(7, 30000, NULL, 3000, NULL)
ON CONFLICT(product_variant_id) DO NOTHING;

-- Seafood (8, 9) - weight
INSERT INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units) VALUES
(8, 40000, NULL, 4000, NULL),
(9, 40000, NULL, 4000, NULL)
ON CONFLICT(product_variant_id) DO NOTHING;

-- Eggs (10, 11) - piece
INSERT INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, safety_threshold_grams, safety_threshold_units) VALUES
(10, NULL, 100, NULL, 10),
(11, NULL, 500, NULL, 50)
ON CONFLICT(product_variant_id) DO NOTHING;
