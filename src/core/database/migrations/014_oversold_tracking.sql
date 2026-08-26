-- 012_oversold_tracking.sql

CREATE TABLE IF NOT EXISTS oversold_unreconciled (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    invoice_item_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    shortfall_grams INTEGER,
    shortfall_units INTEGER,
    manager_id INTEGER NOT NULL,
    override_reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    FOREIGN KEY(invoice_item_id) REFERENCES invoice_items(id),
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id),
    FOREIGN KEY(manager_id) REFERENCES users(id)
);
