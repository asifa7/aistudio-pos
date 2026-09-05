-- Migration 049: Customer Intelligence Analytics Cache Table

CREATE TABLE IF NOT EXISTS customer_analytics_cache (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  segment TEXT NOT NULL DEFAULT 'New',
  metrics_json TEXT NOT NULL,
  last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_segment ON customer_analytics_cache(segment);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_calculated ON customer_analytics_cache(last_calculated_at);
