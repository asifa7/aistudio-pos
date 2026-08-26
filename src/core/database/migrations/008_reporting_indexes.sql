-- Migration: Add Reporting & Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_completed_at_status ON invoices(completed_at, status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at, product_variant_id);
