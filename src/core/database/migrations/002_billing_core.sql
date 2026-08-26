-- 002_billing_core.sql
-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK(unit_type IN ('weight', 'piece')),
    category TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    variant_name TEXT NOT NULL,
    current_rate_paise_per_unit INTEGER NOT NULL,
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL CHECK(is_active IN (0, 1)),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, variant_name)
);

-- Create Product Variant Rate History Table
CREATE TABLE IF NOT EXISTS product_variant_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    rate_paise_per_unit INTEGER NOT NULL,
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    set_by INTEGER NOT NULL,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY(set_by) REFERENCES users(id)
);

-- Create Invoice Sequences Table
CREATE TABLE IF NOT EXISTS invoice_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    financial_year TEXT UNIQUE NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0
);

-- Create Invoices Table (Invoice-level discount_paise is removed for strict line audit trail)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    financial_year TEXT,
    customer_id INTEGER,
    customer_face_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('draft', 'held', 'completed', 'void', 'returned')),
    is_gst_invoice INTEGER DEFAULT 0 NOT NULL CHECK(is_gst_invoice IN (0, 1)),
    gst_number_snapshot TEXT,
    subtotal_paise INTEGER NOT NULL,
    cgst_paise INTEGER NOT NULL,
    sgst_paise INTEGER NOT NULL,
    tax_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    payment_status TEXT NOT NULL CHECK(payment_status IN ('unpaid', 'partial', 'paid')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    voided_by INTEGER,
    void_reason TEXT,
    voided_at DATETIME,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(voided_by) REFERENCES users(id)
);

-- Create Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    rate_paise_snapshot INTEGER NOT NULL,
    line_subtotal_paise INTEGER NOT NULL,
    gst_rate_percent_snapshot INTEGER, -- Basis points (e.g. 500 = 5.00%)
    line_total_paise INTEGER NOT NULL,
    override_applied INTEGER DEFAULT 0 NOT NULL CHECK(override_applied IN (0, 1)),
    override_reason TEXT,
    overridden_by INTEGER,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id),
    FOREIGN KEY(overridden_by) REFERENCES users(id),
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR 
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    )
);

-- Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('cash', 'upi', 'card', 'split')),
    amount_paise INTEGER NOT NULL,
    reference_number TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create Pending Stock Events Table
CREATE TABLE IF NOT EXISTS pending_stock_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    invoice_item_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_grams INTEGER,
    quantity_units INTEGER,
    event_type TEXT NOT NULL CHECK(event_type IN ('sale_pending_deduction', 'sale_reversal')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(invoice_item_id) REFERENCES invoice_items(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id),
    CHECK(
        (quantity_grams IS NOT NULL AND quantity_units IS NULL) OR 
        (quantity_grams IS NULL AND quantity_units IS NOT NULL)
    )
);

-- Add Indexings for high performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_fy_num ON invoices(financial_year, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Seed Sample Products
INSERT INTO products (id, product_code, name, unit_type, category) VALUES 
(1, 'PRD-00001', 'Fresh Chicken', 'weight', 'Chicken'),
(2, 'PRD-00002', 'Premium Mutton', 'weight', 'Mutton'),
(3, 'PRD-00003', 'Seafood Rohu', 'weight', 'Seafood'),
(4, 'PRD-00004', 'Organic Eggs (Tray)', 'piece', 'Eggs')
ON CONFLICT(product_code) DO NOTHING;

-- Seed Sample Product Variants (Rates in Paise, e.g. 28000 = ₹280.00)
-- Chicken Variants
INSERT INTO product_variants (id, product_id, variant_name, current_rate_paise_per_unit) VALUES
(1, 1, 'Whole Chicken', 22000),      -- ₹220/kg
(2, 1, 'Curry Cut Chicken', 26000),  -- ₹260/kg
(3, 1, 'Boneless Chicken', 35000),   -- ₹350/kg
(4, 1, 'Skinless Chicken', 28000)    -- ₹280/kg
ON CONFLICT(product_id, variant_name) DO NOTHING;

-- Mutton Variants
INSERT INTO product_variants (id, product_id, variant_name, current_rate_paise_per_unit) VALUES
(5, 2, 'Mutton Curry Cut', 72000),   -- ₹720/kg
(6, 2, 'Mutton Keema', 85000),       -- ₹850/kg
(7, 2, 'Mutton Chops', 78000)        -- ₹780/kg
ON CONFLICT(product_id, variant_name) DO NOTHING;

-- Seafood Variants
INSERT INTO product_variants (id, product_id, variant_name, current_rate_paise_per_unit) VALUES
(8, 3, 'Whole Rohu (Cleaned)', 28000), -- ₹280/kg
(9, 3, 'Rohu Steaks', 32000)          -- ₹320/kg
ON CONFLICT(product_id, variant_name) DO NOTHING;

-- Eggs Variant
INSERT INTO product_variants (id, product_id, variant_name, current_rate_paise_per_unit) VALUES
(10, 4, 'Tray of 30 Eggs', 18000),    -- ₹180/tray
(11, 4, 'Single Egg', 700)            -- ₹7.00/piece
ON CONFLICT(product_id, variant_name) DO NOTHING;

-- Seed Rate History for original rates (set by user id 1)
INSERT INTO product_variant_rate_history (product_variant_id, rate_paise_per_unit, set_by) VALUES
(1, 22000, 1), (2, 26000, 1), (3, 35000, 1), (4, 28000, 1),
(5, 72000, 1), (6, 85000, 1), (7, 78000, 1),
(8, 28000, 1), (9, 32000, 1),
(10, 18000, 1), (11, 700, 1)
ON CONFLICT DO NOTHING;
