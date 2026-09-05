-- Migration 050: Customer UPI Identities Table for Business UPI Matching

CREATE TABLE IF NOT EXISTS customer_upi_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vpa TEXT NOT NULL,
  payer_name TEXT,
  verified_count INTEGER DEFAULT 1,
  auto_link INTEGER DEFAULT 0,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vpa, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_upi_vpa ON customer_upi_identities(vpa);
CREATE INDEX IF NOT EXISTS idx_customer_upi_customer ON customer_upi_identities(customer_id);
