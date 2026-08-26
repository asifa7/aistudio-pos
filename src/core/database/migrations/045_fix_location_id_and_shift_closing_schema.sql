-- Migration 045: Permanent location_id fix for stock_ledger & Shift Closing / History System

-- 1. Ensure stock_ledger table exists and has location_id
CREATE TABLE IF NOT EXISTS stock_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_variant_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL DEFAULT 1,
  quantity_grams INTEGER,
  quantity_units INTEGER,
  quantity_count INTEGER,
  safety_threshold_grams INTEGER DEFAULT 0,
  safety_threshold_units INTEGER DEFAULT 0,
  safety_threshold_count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

ALTER TABLE stock_ledger ADD COLUMN location_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_stock_ledger_variant ON stock_ledger(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_location ON stock_ledger(location_id);

-- 2. Shift Cash Movements Table (Categorized Cash In, Cash Out, and Shop Expenses)
CREATE TABLE IF NOT EXISTS shift_cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  session_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('cash_in', 'cash_out', 'expense')),
  category TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  reason TEXT NOT NULL,
  added_by TEXT,
  taken_by TEXT,
  expense_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES pos_sessions(id),
  FOREIGN KEY(expense_id) REFERENCES expenses(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_movements_session ON shift_cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_shift_movements_type ON shift_cash_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_shift_movements_created ON shift_cash_movements(created_at);

-- 3. Shift Closing Records Table (Reconciliation Snapshots)
CREATE TABLE IF NOT EXISTS shift_closing_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  session_id INTEGER NOT NULL UNIQUE,
  expected_cash_paise INTEGER NOT NULL,
  physical_cash_paise INTEGER NOT NULL,
  difference_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('matched', 'explained_difference', 'corrected')),
  declared_reason TEXT,
  closing_denominations_json TEXT,
  non_cash_summary_json TEXT,
  closed_by INTEGER NOT NULL,
  closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES pos_sessions(id),
  FOREIGN KEY(closed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_closing_session ON shift_closing_records(session_id);
CREATE INDEX IF NOT EXISTS idx_shift_closing_status ON shift_closing_records(status);
CREATE INDEX IF NOT EXISTS idx_shift_closing_closed_at ON shift_closing_records(closed_at);

-- 4. Shift Corrections Table (Manager Audit Log for Corrections after Shift Close)
CREATE TABLE IF NOT EXISTS shift_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  session_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('cash_movement', 'closing_record', 'session_status')),
  entity_id INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  authorized_by INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES pos_sessions(id),
  FOREIGN KEY(authorized_by) REFERENCES users(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_corrections_session ON shift_corrections(session_id);
CREATE INDEX IF NOT EXISTS idx_shift_corrections_entity ON shift_corrections(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shift_corrections_created ON shift_corrections(created_at);
