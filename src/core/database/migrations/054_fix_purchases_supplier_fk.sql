-- Migration 054: Fix purchases table foreign key linkage to suppliers
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS purchases_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    cost_paise INTEGER NOT NULL,
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

INSERT INTO purchases_temp (id, supplier_id, product_variant_id, quantity_grams, quantity_units, cost_paise, created_by, created_at)
SELECT id, supplier_id, product_variant_id, quantity_grams, quantity_units, cost_paise, created_by, created_at
FROM purchases;

DROP TABLE purchases;

ALTER TABLE purchases_temp RENAME TO purchases;

CREATE INDEX IF NOT EXISTS idx_purchases_variant ON purchases(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

DROP TABLE IF EXISTS suppliers_stub_backup;

PRAGMA foreign_keys = ON;
