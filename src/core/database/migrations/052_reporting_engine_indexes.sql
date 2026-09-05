-- Migration 052: Performance Indexes and Schema Columns for Reporting Engine
-- Ensures location_id, shift_id, and counter_id exist on invoices and creates indexes.

-- Add columns if not already present on invoices
ALTER TABLE invoices ADD COLUMN location_id INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN shift_id INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN counter_id TEXT DEFAULT 'Counter 1';

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer_completed ON invoices(customer_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by_completed ON invoices(created_by, completed_at);
CREATE INDEX IF NOT EXISTS idx_invoices_location_completed ON invoices(location_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_invoices_shift_completed ON invoices(shift_id, completed_at);

-- Invoice items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_variant ON invoice_items(invoice_id, product_variant_id);

-- Product and variant indexes
ALTER TABLE products ADD COLUMN subcategory TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Payment methods index
CREATE INDEX IF NOT EXISTS idx_payments_invoice_method ON payments(invoice_id, method);

-- Customers index
CREATE INDEX IF NOT EXISTS idx_customers_group_category ON customers(group_id, category);
