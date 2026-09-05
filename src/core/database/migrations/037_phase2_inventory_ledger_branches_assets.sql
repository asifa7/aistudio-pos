-- Migration 037: Phase Set 2, Phase 1 - Branches, Inventory Ledger, Asset Items, Replacement Log, and Product Stock Classification

-- 1. Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default Main Store & Branch 1
INSERT OR IGNORE INTO branches (id, code, name, address, phone, is_active, is_default)
VALUES 
  (1, 'BR-MAIN', 'Main Store', '123 Central Market', '+91 98765 43210', 1, 1),
  (2, 'BR-BRANCH-1', 'Branch Store 1', '45 North Extension', '+91 98765 43211', 1, 0);

-- Sync locations if table exists
INSERT OR IGNORE INTO branches (id, code, name, address, phone, is_active, is_default)
SELECT id, code, name, address, phone, is_active, is_default FROM locations WHERE id NOT IN (SELECT id FROM branches);

-- 2. Inventory Ledger Table (Unified source of truth for all stock movements)
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL DEFAULT 1,
    action_type TEXT NOT NULL CHECK(action_type IN ('purchase', 'sale', 'return', 'transfer_out', 'transfer_in', 'yield_in', 'yield_out', 'audit_adjustment', 'wastage', 'fridge_deposit', 'fridge_removal')),
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

CREATE INDEX IF NOT EXISTS idx_inv_ledger_variant ON inventory_ledger(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_branch ON inventory_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_action ON inventory_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_ref ON inventory_ledger(reference_type, reference_id);

-- 3. Asset Items Table
CREATE TABLE IF NOT EXISTS asset_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    purchase_cost_paise INTEGER NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'damaged', 'replaced', 'disposed')),
    branch_id INTEGER DEFAULT 1,
    times_replaced INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_status ON asset_items(status);
CREATE INDEX IF NOT EXISTS idx_asset_category ON asset_items(category);
CREATE INDEX IF NOT EXISTS idx_asset_branch ON asset_items(branch_id);

-- 4. Asset Replacement Log Table
CREATE TABLE IF NOT EXISTS asset_replacement_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    replacement_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    replacement_cost_paise INTEGER DEFAULT 0,
    notes TEXT,
    logged_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(asset_id) REFERENCES asset_items(id) ON DELETE CASCADE,
    FOREIGN KEY(logged_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_replacement_asset ON asset_replacement_log(asset_id);

-- 5. Product Stock Classification (Live/Yield-Tracked vs Refrigerator/Direct Stock)
-- Add stock_classification column to products if not present
ALTER TABLE products ADD COLUMN stock_classification TEXT NOT NULL DEFAULT 'refrigerator_direct';

-- Classify live birds / live animals as 'live_yield'
UPDATE products 
SET stock_classification = 'live_yield' 
WHERE category = 'Chicken' AND (
  LOWER(name) LIKE '%live%' OR 
  LOWER(name) LIKE '%bird%'
);
