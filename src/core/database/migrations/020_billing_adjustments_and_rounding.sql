-- Migration 020: Add billing adjustments (discount %, flat deduction, dressing charge, narration, print delivery token) and round off.

ALTER TABLE invoices ADD COLUMN discount_percent REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN flat_deduction_paise INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN dressing_charge_paise INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN round_off_paise INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN narration TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN print_delivery_token INTEGER DEFAULT 0;
