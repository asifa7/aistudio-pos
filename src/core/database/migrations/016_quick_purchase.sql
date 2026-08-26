-- Migration: 016_quick_purchase.sql
-- Add status and file_path to purchase_invoices for pending approval workflows

-- 1. Add status to purchase_invoices
ALTER TABLE purchase_invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending_approval', 'approved', 'rejected'));

-- 2. Add file_path for bill photos
ALTER TABLE purchase_invoices ADD COLUMN file_path TEXT;

-- 3. Add status to supplier_ledger to mirror the unconfirmed financial commitment
ALTER TABLE supplier_ledger ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending_approval', 'approved', 'rejected'));
