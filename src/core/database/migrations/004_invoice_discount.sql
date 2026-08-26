-- 004_invoice_discount.sql
-- Add discount fields to invoices table
ALTER TABLE invoices ADD COLUMN discount_paise INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN discount_reason TEXT;
ALTER TABLE invoices ADD COLUMN discount_applied_by INTEGER REFERENCES users(id);

-- Fix legacy category naming in products table to match unified taxonomy (Chicken, Mutton, Seafood, Eggs)
UPDATE products SET category = 'Chicken' WHERE category = 'Poultry';
UPDATE products SET category = 'Mutton' WHERE category = 'Meat';
UPDATE products SET category = 'Eggs' WHERE category = 'Organic Eggs (Tray)';
