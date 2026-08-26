-- 007_invoice_shop_snapshot.sql
ALTER TABLE invoices ADD COLUMN shop_name_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN shop_address_snapshot TEXT;
