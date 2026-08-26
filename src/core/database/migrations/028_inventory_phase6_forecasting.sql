-- Migration 028: Phase 6 Statistical Demand Forecasting & Festival Calendar

-- 1. Calendar Events Table (Hindu Fasting / Festival / Regional Events)
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  impact_level TEXT NOT NULL CHECK(impact_level IN ('High', 'Normal', 'Low', 'Very_Low')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);

-- 2. Bulk Orders Table
CREATE TABLE IF NOT EXISTS bulk_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_date DATE NOT NULL,
  product_variant_id INTEGER NOT NULL,
  quantity_grams INTEGER,
  quantity_units INTEGER,
  customer_name_or_notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fulfilled', 'cancelled')),
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_variant_id) REFERENCES product_variants(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bulk_orders_date ON bulk_orders(delivery_date, status);

-- 3. Seed Hindu Festival & Fasting dates for Chennai/Tamil Nadu region (Current and upcoming 3 months: Aug 2026 - Nov 2026)
INSERT OR IGNORE INTO calendar_events (event_name, event_date, impact_level, notes) VALUES
  ('Aadi Perukku', '2026-08-03', 'Normal', 'Aadi festival celebrations'),
  ('Ekadashi Fasting', '2026-08-08', 'Low', 'Hindu fasting day - reduced meat consumption (0.6x)'),
  ('Pradosham', '2026-08-10', 'Low', 'Fasting day for Lord Shiva'),
  ('Independence Day', '2026-08-15', 'High', 'Weekend & holiday gathering - higher meat demand (1.4x)'),
  ('Ganesh Chaturthi', '2026-08-27', 'Very_Low', 'Major Hindu festival - strict vegetarian day (0.3x)'),
  ('Ekadashi Fasting', '2026-09-07', 'Low', 'Hindu fasting day (0.6x)'),
  ('Purattasi Saturday Fasting 1', '2026-09-19', 'Very_Low', 'Purattasi Saturday - strict vegetarian fasting in TN (0.3x)'),
  ('Purattasi Saturday Fasting 2', '2026-09-26', 'Very_Low', 'Purattasi Saturday - strict vegetarian fasting in TN (0.3x)'),
  ('Purattasi Saturday Fasting 3', '2026-10-03', 'Very_Low', 'Purattasi Saturday - strict vegetarian fasting in TN (0.3x)'),
  ('Purattasi Saturday Fasting 4', '2026-10-10', 'Very_Low', 'Purattasi Saturday - strict vegetarian fasting in TN (0.3x)'),
  ('Navratri Starts', '2026-10-12', 'Very_Low', '9-day Navratri festival begins - vegetarian period (0.3x)'),
  ('Saraswathi Poojai / Ayudha Poojai', '2026-10-19', 'Very_Low', 'Poojai day - strict vegetarian (0.3x)'),
  ('Vijayadashami', '2026-10-20', 'Normal', 'Dussehra day'),
  ('Deepavali / Diwali', '2026-11-08', 'High', 'Festival celebrations - high meat feast demand (1.4x)');
