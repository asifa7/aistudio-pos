-- Migration 040: Payment Reversals, Idempotency, and Audit Tracking

ALTER TABLE payments_receipts ADD COLUMN idempotency_key TEXT;
ALTER TABLE payments_receipts ADD COLUMN is_reversed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments_receipts ADD COLUMN reversed_at DATETIME;
ALTER TABLE payments_receipts ADD COLUMN reversal_reason TEXT;
ALTER TABLE payments_receipts ADD COLUMN reversed_by INTEGER;
ALTER TABLE payments_receipts ADD COLUMN reversed_payment_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_rec_idempotency ON payments_receipts(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pay_rec_reversed ON payments_receipts(is_reversed);
CREATE INDEX IF NOT EXISTS idx_pay_rec_parent ON payments_receipts(reversed_payment_id);
