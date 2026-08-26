-- Migration 022: Inventory Phase 2 Purchases, Suppliers & Returns
-- 1. Daily Purchase Sequence Tracking Table
CREATE TABLE IF NOT EXISTS daily_purchase_sequences (
  sequence_date TEXT PRIMARY KEY, -- Format: YYYYMMDD
  last_number INTEGER NOT NULL DEFAULT 0
);

-- 2. Purchase Returns Tables
CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT UNIQUE NOT NULL,
  purchase_invoice_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  total_return_amount_paise INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id),
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_return_id INTEGER NOT NULL,
  product_variant_id INTEGER NOT NULL,
  quantity_grams INTEGER,
  quantity_units INTEGER,
  unit_cost_paise INTEGER NOT NULL,
  return_total_paise INTEGER NOT NULL,
  return_reason TEXT,
  FOREIGN KEY(purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
);

-- 3. Customer Sales Returns Tables
CREATE TABLE IF NOT EXISTS sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL,
  customer_id INTEGER,
  refund_method TEXT NOT NULL CHECK(refund_method IN ('cash', 'credit_balance', 'credit_note')),
  total_refund_paise INTEGER NOT NULL,
  reason TEXT NOT NULL,
  processed_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id),
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(processed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_return_id INTEGER NOT NULL,
  invoice_item_id INTEGER NOT NULL,
  product_variant_id INTEGER NOT NULL,
  quantity_grams INTEGER,
  quantity_units INTEGER,
  unit_rate_paise INTEGER NOT NULL,
  refund_total_paise INTEGER NOT NULL,
  FOREIGN KEY(sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY(invoice_item_id) REFERENCES invoice_items(id),
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
);
