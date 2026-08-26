-- 034_auto_yield_conversion.sql
-- Add auto-yield formula linkage to product_variants

ALTER TABLE product_variants ADD COLUMN parent_variant_id INTEGER DEFAULT NULL REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN yield_ratio REAL DEFAULT NULL;
