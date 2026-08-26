-- Migration 023: Inventory Phase 3 Batch Management, FIFO Costing & Yield Processing

-- 1. Product Stock Batches Table
CREATE TABLE IF NOT EXISTS product_stock_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_number TEXT UNIQUE NOT NULL,
  product_variant_id INTEGER NOT NULL,
  received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  initial_quantity_grams INTEGER,
  initial_quantity_units INTEGER,
  current_quantity_grams INTEGER,
  current_quantity_units INTEGER,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL CHECK(source_type IN ('purchase', 'yield_processing', 'initial_balance', 'adjustment')),
  source_ref_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_variant_fifo 
ON product_stock_batches(product_variant_id, status, received_date ASC, id ASC);

-- 2. Yield Processing Runs Table
CREATE TABLE IF NOT EXISTS yield_processing_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_number TEXT UNIQUE NOT NULL,
  raw_input_variant_id INTEGER NOT NULL,
  input_quantity_grams INTEGER,
  input_quantity_units INTEGER,
  total_input_cost_paise INTEGER NOT NULL DEFAULT 0,
  wastage_quantity_grams INTEGER NOT NULL DEFAULT 0,
  wastage_quantity_units INTEGER NOT NULL DEFAULT 0,
  processed_by INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(raw_input_variant_id) REFERENCES product_variants(id),
  FOREIGN KEY(processed_by) REFERENCES users(id)
);

-- 3. Yield Processing Outputs Table
CREATE TABLE IF NOT EXISTS yield_processing_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  yield_run_id INTEGER NOT NULL,
  output_variant_id INTEGER NOT NULL,
  output_quantity_grams INTEGER,
  output_quantity_units INTEGER,
  allocated_cost_paise INTEGER NOT NULL DEFAULT 0,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  output_batch_id INTEGER,
  FOREIGN KEY(yield_run_id) REFERENCES yield_processing_runs(id) ON DELETE CASCADE,
  FOREIGN KEY(output_variant_id) REFERENCES product_variants(id),
  FOREIGN KEY(output_batch_id) REFERENCES product_stock_batches(id)
);

-- 4. Add fifo_cogs_paise to invoice_items if not present
-- Note: SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we handle safely in code or insert migration
-- 5. Seed initial batches for existing stock in stock_ledger that have no batches yet
INSERT INTO product_stock_batches (
  batch_number,
  product_variant_id,
  received_date,
  initial_quantity_grams,
  initial_quantity_units,
  current_quantity_grams,
  current_quantity_units,
  unit_cost_paise,
  source_type,
  status
)
SELECT 
  'BAT-INIT-' || sl.product_variant_id,
  sl.product_variant_id,
  CURRENT_TIMESTAMP,
  sl.quantity_grams,
  sl.quantity_units,
  sl.quantity_grams,
  sl.quantity_units,
  COALESCE((SELECT AVG(pur.unit_price_paise) FROM purchase_invoice_items pur WHERE pur.product_variant_id = pv.id), pv.cost_price_paise_per_unit, 0),
  'initial_balance',
  CASE WHEN (COALESCE(sl.quantity_grams, 0) > 0 OR COALESCE(sl.quantity_units, 0) > 0) THEN 'active' ELSE 'exhausted' END
FROM stock_ledger sl
JOIN product_variants pv ON pv.id = sl.product_variant_id
WHERE NOT EXISTS (
  SELECT 1 FROM product_stock_batches psb WHERE psb.product_variant_id = sl.product_variant_id
)
AND (COALESCE(sl.quantity_grams, 0) > 0 OR COALESCE(sl.quantity_units, 0) > 0);
