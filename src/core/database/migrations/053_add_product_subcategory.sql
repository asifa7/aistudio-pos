-- Migration 053: Ensure subcategory exists on products
ALTER TABLE products ADD COLUMN subcategory TEXT DEFAULT '';
