-- Migration 018: Add extended supplier profile fields for Zoho Books style depth
ALTER TABLE suppliers ADD COLUMN salutation TEXT;
ALTER TABLE suppliers ADD COLUMN first_name TEXT;
ALTER TABLE suppliers ADD COLUMN last_name TEXT;
ALTER TABLE suppliers ADD COLUMN display_name TEXT;
ALTER TABLE suppliers ADD COLUMN work_phone TEXT;
ALTER TABLE suppliers ADD COLUMN mobile_phone TEXT;
ALTER TABLE suppliers ADD COLUMN payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE suppliers ADD COLUMN billing_address_json TEXT;
ALTER TABLE suppliers ADD COLUMN bank_name TEXT;
ALTER TABLE suppliers ADD COLUMN account_number TEXT;
ALTER TABLE suppliers ADD COLUMN ifsc_code TEXT;
ALTER TABLE suppliers ADD COLUMN remarks TEXT;
ALTER TABLE suppliers ADD COLUMN document_paths_json TEXT;
