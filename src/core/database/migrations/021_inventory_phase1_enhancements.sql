-- Migration 021: Inventory Phase 1 Core Completion Enhancements
-- 1. Add cost_price_paise_per_unit and barcode to product_variants if not existing
ALTER TABLE product_variants ADD COLUMN cost_price_paise_per_unit INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN barcode TEXT DEFAULT NULL;

-- 2. Create inventory_metadata table for key-value settings (e.g. last_physical_count_at)
CREATE TABLE IF NOT EXISTS inventory_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
