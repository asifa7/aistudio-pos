-- Migration 025: Add real_cogs_paise, estimated_cogs_paise, and is_estimated_cogs columns to invoice_items

ALTER TABLE invoice_items ADD COLUMN real_cogs_paise INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN estimated_cogs_paise INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN is_estimated_cogs INTEGER DEFAULT 0;
