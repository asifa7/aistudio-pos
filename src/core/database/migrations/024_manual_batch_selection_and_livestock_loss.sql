-- Migration 024: Manual Batch Selection on Billing & Livestock Loss Quick Wastage Entry

-- 1. Invoice Item Batch Allocations Table (for auditing manual batch picks)
CREATE TABLE IF NOT EXISTS invoice_item_batch_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_item_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  quantity_grams INTEGER,
  quantity_units INTEGER,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_item_id) REFERENCES invoice_items(id) ON DELETE CASCADE,
  FOREIGN KEY(batch_id) REFERENCES product_stock_batches(id)
);

-- 2. Add is_manual_batch_selected flag to invoice_items if not present
-- Handled safely in backend code or direct column check
ALTER TABLE invoice_items ADD COLUMN is_manual_batch_selected INTEGER DEFAULT 0;
