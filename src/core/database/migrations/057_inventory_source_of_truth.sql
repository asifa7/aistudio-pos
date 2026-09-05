-- 057_inventory_source_of_truth.sql
-- Unified Inventory Ledger, Storage Locations, Physical Audit Sessions & Aging Preservation

PRAGMA foreign_keys=OFF;

-- 1. Add is_inventory_tracked to products if not exists
-- Note: SQLite does not fail if column exists when we check or handle gracefully
ALTER TABLE products ADD COLUMN is_inventory_tracked INTEGER NOT NULL DEFAULT 1;

-- 2. Add original aging tracking & storage location to product_stock_batches
ALTER TABLE product_stock_batches ADD COLUMN original_batch_date DATETIME DEFAULT NULL;
ALTER TABLE product_stock_batches ADD COLUMN original_batch_id INTEGER DEFAULT NULL;
ALTER TABLE product_stock_batches ADD COLUMN storage_location_id INTEGER DEFAULT 1;

-- Set initial original_batch_date for existing batches
UPDATE product_stock_batches 
SET original_batch_date = COALESCE(received_date, created_at)
WHERE original_batch_date IS NULL;

-- 3. Storage Locations Table (Freezers, Fridges, Counters with space tracking)
CREATE TABLE IF NOT EXISTS storage_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'fridge' CHECK(storage_type IN ('fridge', 'freezer', 'ambient', 'processing', 'counter')),
    capacity_kg REAL NOT NULL DEFAULT 100.0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
    branch_id INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard shop storage locations if empty
INSERT OR IGNORE INTO storage_locations (id, name, code, storage_type, capacity_kg, status, branch_id, notes)
VALUES 
  (1, 'Fridge A (Main Walk-in)', 'SL-FRIDGE-A', 'fridge', 150.0, 'active', 1, 'Main raw meat storage chiller (0-4°C)'),
  (2, 'Fridge B (Display Chiller)', 'SL-FRIDGE-B', 'fridge', 100.0, 'active', 1, 'Front retail display refrigerator'),
  (3, 'Deep Freezer 1', 'SL-FREEZER-1', 'freezer', 200.0, 'active', 1, 'Long-term frozen items (-18°C)'),
  (4, 'Cutting / Processing Counter', 'SL-COUNTER', 'processing', 50.0, 'active', 1, 'Daily active prep station');

-- 4. Physical Stock Audit Sessions & Items (Workflow: draft -> counting -> submitted -> reviewed -> approved -> applied)
CREATE TABLE IF NOT EXISTS physical_stock_audit_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'counting', 'submitted', 'reviewed', 'approved', 'applied', 'cancelled')),
    branch_id INTEGER DEFAULT 1,
    storage_location_id INTEGER REFERENCES storage_locations(id),
    counted_by INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    applied_by INTEGER REFERENCES users(id),
    total_items_counted INTEGER DEFAULT 0,
    total_variance_grams INTEGER DEFAULT 0,
    total_variance_units INTEGER DEFAULT 0,
    total_variance_value_paise INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    approved_at DATETIME,
    applied_at DATETIME
);

CREATE TABLE IF NOT EXISTS physical_stock_audit_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES physical_stock_audit_sessions(id) ON DELETE CASCADE,
    product_variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    unit_type TEXT NOT NULL DEFAULT 'weight',
    system_quantity_grams INTEGER,
    system_quantity_units INTEGER,
    counted_quantity_grams INTEGER,
    counted_quantity_units INTEGER,
    variance_grams INTEGER,
    variance_units INTEGER,
    unit_cost_paise INTEGER DEFAULT 0,
    variance_value_paise INTEGER DEFAULT 0,
    reason_code TEXT CHECK(reason_code IS NULL OR reason_code IN ('cutting_loss', 'wastage', 'spoilage', 'measurement_error', 'unrecorded_sale', 'unrecorded_purchase', 'other')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_items_session ON physical_stock_audit_items(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_variant ON physical_stock_audit_items(product_variant_id);

-- 5. Recreate inventory_ledger to support complete canonical movement types and location/batch links
CREATE TABLE IF NOT EXISTS inventory_ledger_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    product_id INTEGER,
    branch_id INTEGER NOT NULL DEFAULT 1,
    action_type TEXT NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    running_balance_grams INTEGER,
    running_balance_units INTEGER,
    unit_cost_paise INTEGER DEFAULT 0,
    batch_id INTEGER REFERENCES product_stock_batches(id),
    source_location_id INTEGER,
    destination_location_id INTEGER,
    reference_type TEXT,
    reference_id INTEGER,
    reference_number TEXT,
    reason_code TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Copy existing data safely into inventory_ledger_v2
INSERT INTO inventory_ledger_v2 (
    id, product_variant_id, branch_id, action_type,
    quantity_grams, quantity_units, running_balance_grams, running_balance_units,
    unit_cost_paise, reference_type, reference_id, reference_number,
    notes, created_by, created_at
)
SELECT 
    id, product_variant_id, branch_id, action_type,
    quantity_grams, quantity_units, running_balance_grams, running_balance_units,
    unit_cost_paise, reference_type, reference_id, reference_number,
    notes, created_by, created_at
FROM inventory_ledger;

-- Populate product_id in inventory_ledger_v2 from product_variants
UPDATE inventory_ledger_v2
SET product_id = (SELECT product_id FROM product_variants WHERE id = inventory_ledger_v2.product_variant_id)
WHERE product_id IS NULL;

DROP TABLE inventory_ledger;
ALTER TABLE inventory_ledger_v2 RENAME TO inventory_ledger;

CREATE INDEX IF NOT EXISTS idx_inv_ledger_variant ON inventory_ledger(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_product ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_branch ON inventory_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_action ON inventory_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_ref ON inventory_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_batch ON inventory_ledger(batch_id);

PRAGMA foreign_keys=ON;
