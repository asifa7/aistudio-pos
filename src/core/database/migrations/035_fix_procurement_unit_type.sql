-- ============================================================
-- 035_fix_procurement_unit_type.sql
-- Relax CHECK constraint on unit_type to include 'live_dual'
-- ============================================================

-- Recreate purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_type TEXT CHECK (unit_type IN ('weight', 'piece', 'live_dual')),
    unit_price_paise INTEGER NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

INSERT INTO purchase_order_items_new SELECT * FROM purchase_order_items;
DROP TABLE purchase_order_items;
ALTER TABLE purchase_order_items_new RENAME TO purchase_order_items;
