-- Migration 039: Product Tracking Change Audit Log

CREATE TABLE IF NOT EXISTS product_tracking_change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    old_track_in_inventory INTEGER NOT NULL,
    new_track_in_inventory INTEGER NOT NULL,
    reason TEXT NOT NULL,
    changed_by INTEGER,
    changed_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prod_track_log_product ON product_tracking_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_track_log_created ON product_tracking_change_log(created_at);
