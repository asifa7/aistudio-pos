-- 006_purchase_ledger.sql
-- Create Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    cost_paise INTEGER NOT NULL, -- stored in integer paise
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id),
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR 
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_purchases_variant ON purchases(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
