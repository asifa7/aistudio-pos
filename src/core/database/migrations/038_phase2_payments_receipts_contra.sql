-- Migration 038: Phase Set 2, Phase 2 - Payments, Receipts, Bill Allocations, and Contra Transfers

-- 1. Payments & Receipts Master Table
CREATE TABLE IF NOT EXISTS payments_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_number TEXT UNIQUE NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('payment', 'receipt')),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'bank', 'upi', 'card')),
    party_type TEXT CHECK(party_type IN ('supplier', 'customer', 'other')),
    party_id INTEGER,
    party_name TEXT,
    category TEXT,
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    allocated_amount_paise INTEGER NOT NULL DEFAULT 0,
    unallocated_amount_paise INTEGER NOT NULL DEFAULT 0,
    payment_date TEXT NOT NULL,
    narration TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pay_rec_direction ON payments_receipts(direction);
CREATE INDEX IF NOT EXISTS idx_pay_rec_party ON payments_receipts(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_pay_rec_date ON payments_receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_pay_rec_method ON payments_receipts(payment_method);

-- 2. Payment Allocations Table (Bill-wise settlement)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_receipt_id INTEGER NOT NULL,
    bill_type TEXT NOT NULL CHECK(bill_type IN ('purchase_invoice', 'sale_invoice')),
    bill_id INTEGER NOT NULL,
    bill_number TEXT NOT NULL,
    allocated_amount_paise INTEGER NOT NULL CHECK(allocated_amount_paise > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(payment_receipt_id) REFERENCES payments_receipts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pay_alloc_voucher ON payment_allocations(payment_receipt_id);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_bill ON payment_allocations(bill_type, bill_id);

-- 3. Contra Entries Table (Internal Cash ⇄ Bank movements)
CREATE TABLE IF NOT EXISTS contra_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_number TEXT UNIQUE NOT NULL,
    from_account TEXT NOT NULL CHECK(from_account IN ('cash', 'bank')),
    to_account TEXT NOT NULL CHECK(to_account IN ('cash', 'bank')),
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    entry_date TEXT NOT NULL,
    narration TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_contra_date ON contra_entries(entry_date);

-- Ensure purchase_invoices has paid_amount_paise if missing
-- SQLite column check / safe add
-- (Columns like total_amount_paise and paid_amount_paise already exist in purchase_invoices schema)
