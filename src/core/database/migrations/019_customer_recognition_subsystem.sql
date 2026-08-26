-- Migration 019: Customer Data System & Camera Recognition Subsystem
-- Enables customer visit logging, facial recognition seams, timestamped notes, and communication tracking

-- 1. Add allow_face_recognition opt-in flag to customers table
ALTER TABLE customers ADD COLUMN allow_face_recognition INTEGER NOT NULL DEFAULT 0;

-- 2. Physical Customer Visits Log
CREATE TABLE IF NOT EXISTS customer_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NULL REFERENCES customers(id) ON DELETE SET NULL,
  visit_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detection_method TEXT NOT NULL CHECK(detection_method IN ('camera_recognition', 'manual', 'phone_lookup')),
  camera_snapshot_path TEXT NULL,
  linked_invoice_id INTEGER NULL REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer Face Profiles for Recognition
CREATE TABLE IF NOT EXISTS customer_face_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  face_embedding_data TEXT NOT NULL, -- Stored as JSON float array (e.g. 512 dimensions)
  reference_photo_path TEXT NULL,    -- Saved in userData/documents/customer_snapshots/
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_matched_at DATETIME NULL,
  match_confidence_threshold REAL NOT NULL DEFAULT 0.85,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Timestamped Customer Preference Notes
CREATE TABLE IF NOT EXISTS customer_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  category TEXT NULL DEFAULT 'preference', -- 'preference', 'billing', 'staff_memo'
  created_by INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Customer Communication Log
CREATE TABLE IF NOT EXISTS customer_communication_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'whatsapp', 'sms', 'email'
  template_type TEXT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER NULL
);

-- 6. Relational Purchase History View
CREATE VIEW IF NOT EXISTS v_customer_purchase_history AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  i.id as invoice_id,
  i.invoice_number,
  i.created_at as invoice_date,
  i.total_paise as total_amount_paise,
  i.payment_status,
  COUNT(ii.id) as total_items
FROM customers c
JOIN invoices i ON i.customer_id = c.id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id;

-- 7. High Performance Foreign Key & Search Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL AND phone != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code_unique ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customer_visits_customer_id ON customer_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_visits_timestamp ON customer_visits(visit_timestamp);
CREATE INDEX IF NOT EXISTS idx_customer_visits_linked_invoice ON customer_visits(linked_invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_face_profiles_customer_id ON customer_face_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_comm_log_customer_id ON customer_communication_log(customer_id);
