-- Migration 047: Expand action_type CHECK constraint on inventory_ledger for refrigerator operations

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS inventory_ledger_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL DEFAULT 1,
    action_type TEXT NOT NULL CHECK(action_type IN (
        'purchase', 'sale', 'return', 'transfer_out', 'transfer_in', 
        'yield_in', 'yield_out', 'audit_adjustment', 'wastage', 
        'fridge_deposit', 'fridge_removal'
    )),
    quantity_grams INTEGER,
    quantity_units INTEGER,
    running_balance_grams INTEGER,
    running_balance_units INTEGER,
    unit_cost_paise INTEGER DEFAULT 0,
    reference_type TEXT,
    reference_id INTEGER,
    reference_number TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

INSERT INTO inventory_ledger_temp SELECT * FROM inventory_ledger;

DROP TABLE inventory_ledger;

ALTER TABLE inventory_ledger_temp RENAME TO inventory_ledger;

CREATE INDEX IF NOT EXISTS idx_inv_ledger_variant ON inventory_ledger(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_branch ON inventory_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_action ON inventory_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_ref ON inventory_ledger(reference_type, reference_id);

PRAGMA foreign_keys=ON;
