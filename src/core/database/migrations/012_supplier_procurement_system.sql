-- 011_supplier_procurement_system.sql
PRAGMA foreign_keys = OFF;

-- Create supplier_categories table first as it is referenced by suppliers
CREATE TABLE IF NOT EXISTS supplier_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Recreate suppliers table with full enterprise fields
ALTER TABLE suppliers RENAME TO suppliers_stub_backup;

CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    owner_name TEXT,
    gstin TEXT,
    pan TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    category_id INTEGER,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_preferred INTEGER DEFAULT 0 CHECK (is_preferred IN (0, 1)),
    credit_limit_paise INTEGER DEFAULT 0,
    outstanding_balance_paise INTEGER DEFAULT 0,
    opening_balance_paise INTEGER DEFAULT 0,
    opening_balance_date TEXT,
    preferred_payment_method TEXT,
    notes TEXT,
    tags TEXT,
    rating REAL DEFAULT 5.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES supplier_categories(id) ON DELETE SET NULL
);

-- Copy existing suppliers if any (mapping legacy name -> company_name, contact -> phone)
INSERT INTO suppliers (
    id, code, company_name, phone, created_at, updated_at
)
SELECT
    id,
    code,
    name,
    contact,
    created_at,
    updated_at
FROM suppliers_stub_backup;

-- Create supplier_contacts table
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Create supplier_addresses table
CREATE TABLE IF NOT EXISTS supplier_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    address_type TEXT CHECK (address_type IN ('billing', 'shipping', 'warehouse')),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Create supplier_bank_accounts table
CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    upi_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Create supplier_payment_terms table
CREATE TABLE IF NOT EXISTS supplier_payment_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER UNIQUE NOT NULL,
    payment_terms_days INTEGER DEFAULT 30,
    grace_period_days INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    expected_delivery_date TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'closed', 'cancelled')),
    total_amount_paise INTEGER DEFAULT 0,
    notes TEXT,
    created_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at TEXT,
    revision_number INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_type TEXT CHECK (unit_type IN ('weight', 'piece')),
    unit_price_paise INTEGER NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

-- Create goods_receipts table
CREATE TABLE IF NOT EXISTS goods_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_number TEXT UNIQUE NOT NULL,
    purchase_order_id INTEGER,
    supplier_id INTEGER NOT NULL,
    delivery_note_number TEXT,
    received_date TEXT NOT NULL,
    received_by INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(received_by) REFERENCES users(id)
);

-- Create goods_receipt_items table
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_receipt_id INTEGER NOT NULL,
    purchase_order_item_id INTEGER,
    product_variant_id INTEGER NOT NULL,
    quantity_accepted INTEGER NOT NULL,
    quantity_rejected INTEGER DEFAULT 0,
    rejection_reason TEXT,
    batch_number TEXT,
    expiry_date TEXT,
    FOREIGN KEY(goods_receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
    FOREIGN KEY(purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    supplier_invoice_number TEXT NOT NULL,
    purchase_order_id INTEGER,
    goods_receipt_id INTEGER,
    supplier_id INTEGER NOT NULL,
    invoice_date TEXT NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    gst_paise INTEGER DEFAULT 0,
    cgst_paise INTEGER DEFAULT 0,
    sgst_paise INTEGER DEFAULT 0,
    igst_paise INTEGER DEFAULT 0,
    freight_charges_paise INTEGER DEFAULT 0,
    loading_charges_paise INTEGER DEFAULT 0,
    packing_charges_paise INTEGER DEFAULT 0,
    other_charges_paise INTEGER DEFAULT 0,
    discount_paise INTEGER DEFAULT 0,
    round_off_paise INTEGER DEFAULT 0,
    total_amount_paise INTEGER NOT NULL,
    outstanding_amount_paise INTEGER NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY(goods_receipt_id) REFERENCES goods_receipts(id) ON DELETE SET NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Create purchase_invoice_items table
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_invoice_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_paise INTEGER NOT NULL,
    gst_rate_bps INTEGER DEFAULT 0,
    gst_amount_paise INTEGER DEFAULT 0,
    total_amount_paise INTEGER NOT NULL,
    FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

-- Create purchase_returns table
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT UNIQUE NOT NULL,
    purchase_invoice_id INTEGER,
    supplier_id INTEGER NOT NULL,
    return_date TEXT NOT NULL,
    reason TEXT,
    total_refund_amount_paise INTEGER NOT NULL,
    resolved_via TEXT CHECK (resolved_via IN ('refund', 'replacement', 'debit_note')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE SET NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Create purchase_return_items table
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_return_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_paise INTEGER NOT NULL,
    gst_amount_paise INTEGER DEFAULT 0,
    total_amount_paise INTEGER NOT NULL,
    FOREIGN KEY(purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

-- Create supplier_payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    amount_paise INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'cheque', 'bank_transfer')),
    reference_number TEXT,
    cheque_number TEXT,
    cheque_date TEXT,
    bank_name TEXT,
    payment_date TEXT NOT NULL,
    notes TEXT,
    is_advance INTEGER DEFAULT 0 CHECK (is_advance IN (0, 1)),
    unallocated_amount_paise INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Create supplier_payment_allocations table
CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_payment_id INTEGER NOT NULL,
    purchase_invoice_id INTEGER NOT NULL,
    allocated_amount_paise INTEGER NOT NULL,
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_payment_id) REFERENCES supplier_payments(id) ON DELETE CASCADE,
    FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE
);

-- Create supplier_ledger table
CREATE TABLE IF NOT EXISTS supplier_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('opening_balance', 'purchase_invoice', 'payment', 'purchase_return', 'credit_note', 'debit_note', 'adjustment', 'write_off')),
    ref_id INTEGER,
    description TEXT NOT NULL,
    debit_paise INTEGER DEFAULT 0,
    credit_paise INTEGER DEFAULT 0,
    running_balance_paise INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

-- Create supplier_credit_notes table
CREATE TABLE IF NOT EXISTS supplier_credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    amount_paise INTEGER NOT NULL,
    reason TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Create supplier_debit_notes table
CREATE TABLE IF NOT EXISTS supplier_debit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debit_note_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    amount_paise INTEGER NOT NULL,
    reason TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Create supplier_price_history table
CREATE TABLE IF NOT EXISTS supplier_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    unit_price_paise INTEGER NOT NULL,
    effective_date TEXT NOT NULL,
    purchase_invoice_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
    FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE SET NULL
);

-- Create supplier_activity_logs table
CREATE TABLE IF NOT EXISTS supplier_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    performed_by INTEGER NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY(performed_by) REFERENCES users(id)
);

-- Create supplier_documents table
CREATE TABLE IF NOT EXISTS supplier_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    document_name TEXT NOT NULL,
    document_type TEXT,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Create supplier_contracts table
CREATE TABLE IF NOT EXISTS supplier_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    contract_number TEXT UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    terms TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

-- Create supplier_rating_history table
CREATE TABLE IF NOT EXISTS supplier_rating_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    rating REAL NOT NULL,
    rated_by INTEGER NOT NULL,
    comments TEXT,
    rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY(rated_by) REFERENCES users(id)
);

-- Indexes for Supplier A/R & Procurement
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON suppliers(gstin);
CREATE INDEX IF NOT EXISTS idx_suppliers_outstanding ON suppliers(outstanding_balance_paise);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(order_date);

CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_date ON goods_receipts(received_date);

CREATE INDEX IF NOT EXISTS idx_pi_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pi_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_pi_payment_status ON purchase_invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_date ON supplier_ledger(supplier_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_supplier_price_history_variant ON supplier_price_history(product_variant_id);

PRAGMA foreign_keys = ON;
