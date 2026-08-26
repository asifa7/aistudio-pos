-- Migration 026: Phase 4 Multi-Location Stock Transfers and Location Management

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default Main Store (id = 1) and Branch Store 1 (id = 2) if empty
INSERT OR IGNORE INTO locations (id, code, name, address, phone, is_active, is_default)
VALUES 
  (1, 'LOC-MAIN', 'Main Store', '123 Central Market', '+91 98765 43210', 1, 1),
  (2, 'LOC-BRANCH-1', 'Branch Store 1', '45 North Extension', '+91 98765 43211', 1, 0);

-- 2. Add location_id to product_stock_batches and stock_ledger if not present
ALTER TABLE product_stock_batches ADD COLUMN location_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stock_ledger ADD COLUMN location_id INTEGER NOT NULL DEFAULT 1;

-- 3. Stock Transfers Header Table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_number TEXT UNIQUE NOT NULL,
  from_location_id INTEGER NOT NULL,
  to_location_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_transit', 'received', 'cancelled')),
  initiated_by INTEGER NOT NULL,
  confirmed_by INTEGER,
  notes TEXT,
  discrepancy_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  dispatched_at DATETIME,
  received_at DATETIME,
  FOREIGN KEY(from_location_id) REFERENCES locations(id),
  FOREIGN KEY(to_location_id) REFERENCES locations(id),
  FOREIGN KEY(initiated_by) REFERENCES users(id),
  FOREIGN KEY(confirmed_by) REFERENCES users(id)
);

-- 4. Stock Transfer Items Table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  product_variant_id INTEGER NOT NULL,
  sent_quantity_grams INTEGER,
  sent_quantity_units INTEGER,
  received_quantity_grams INTEGER,
  received_quantity_units INTEGER,
  shortfall_quantity_grams INTEGER DEFAULT 0,
  shortfall_quantity_units INTEGER DEFAULT 0,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
  FOREIGN KEY(batch_id) REFERENCES product_stock_batches(id),
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
);
