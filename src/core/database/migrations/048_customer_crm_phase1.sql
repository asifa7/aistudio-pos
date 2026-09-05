-- Migration 048: Customer CRM Phase 1 — Extended Profile, Preferences & Merge Support

-- 1. Add Status and Merge columns
ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'blocked', 'merged'));
ALTER TABLE customers ADD COLUMN merged_into_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- 2. Add Structured Preference columns
ALTER TABLE customers ADD COLUMN preferred_cut TEXT;
ALTER TABLE customers ADD COLUMN skin_preference TEXT;
ALTER TABLE customers ADD COLUMN cutting_preference TEXT;
ALTER TABLE customers ADD COLUMN typical_quantity TEXT;
ALTER TABLE customers ADD COLUMN delivery_preference TEXT;
ALTER TABLE customers ADD COLUMN packaging_preference TEXT;
ALTER TABLE customers ADD COLUMN special_instructions TEXT;

-- 3. Create Fast Search and Relational Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customers_search_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_search_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_search_whatsapp ON customers(whatsapp);
CREATE INDEX IF NOT EXISTS idx_customers_search_business ON customers(business_name);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(is_active, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_created ON invoices(customer_id, created_at);
