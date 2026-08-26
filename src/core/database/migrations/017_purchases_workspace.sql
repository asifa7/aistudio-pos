-- Migration: 017_purchases_workspace.sql
-- Add purchase_ref_number, purchase_sequences, and purchase_edit_audit_logs

-- 1. Add internal purchase reference number column & index
ALTER TABLE purchase_invoices ADD COLUMN purchase_ref_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoices_ref_number ON purchase_invoices(purchase_ref_number);

-- 2. Create purchase_sequences for PUR-YYYY-XXXXX numbering
CREATE TABLE IF NOT EXISTS purchase_sequences (
    year TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
);

-- 3. Create purchase_edit_audit_logs for tracking 24h edits by Admin/Manager
CREATE TABLE IF NOT EXISTS purchase_edit_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_invoice_id INTEGER NOT NULL,
    edited_by INTEGER NOT NULL,
    edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edit_reason TEXT NOT NULL,
    old_values_json TEXT NOT NULL,
    new_values_json TEXT NOT NULL,
    FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(edited_by) REFERENCES users(id) ON DELETE RESTRICT
);
