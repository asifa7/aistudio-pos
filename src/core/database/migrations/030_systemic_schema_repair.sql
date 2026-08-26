-- Migration 030: Systemic Database Schema Repair (Stock Adjustments & Credit Notes)

-- 1. Add user_id column to stock_adjustments for service compatibility
ALTER TABLE stock_adjustments ADD COLUMN user_id INTEGER;

-- 2. Add year column to credit_note_sequences for credit repository compatibility
ALTER TABLE credit_note_sequences ADD COLUMN year TEXT;

-- 3. Create credit_notes table alias/table for customer credit notes repository
CREATE TABLE IF NOT EXISTS credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    original_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    reason TEXT NOT NULL,
    is_applied INTEGER DEFAULT 0 NOT NULL CHECK(is_applied IN (0,1)),
    applied_to_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    applied_at DATETIME,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
