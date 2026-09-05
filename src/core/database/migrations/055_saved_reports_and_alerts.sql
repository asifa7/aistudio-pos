-- Migration 055: Saved Reports, Favorites, Recents, and Alert Thresholds
-- Phase 6 of Reports Module Overhaul

CREATE TABLE IF NOT EXISTS saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Custom',
  data_source TEXT NOT NULL,
  configuration_json TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_fav ON saved_reports(is_favorite);

CREATE TABLE IF NOT EXISTS recent_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  report_id TEXT NOT NULL,
  report_name TEXT NOT NULL,
  category TEXT NOT NULL,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  parameters_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_reports_user ON recent_reports(user_id, last_accessed_at);

CREATE TABLE IF NOT EXISTS report_favorite_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  report_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_favorites_user ON report_favorite_items(user_id);

CREATE TABLE IF NOT EXISTS report_alert_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  threshold_value REAL NOT NULL,
  unit TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO report_alert_thresholds (alert_key, name, threshold_value, unit, is_enabled) VALUES
('cash_variance_max_paise', 'Max Shift Cash Variance Allowed (paise)', 50000, 'paise', 1),
('purchase_cost_spike_percent', 'Purchase Price Increase Warning (%)', 5.0, 'percent', 1),
('dead_stock_idle_days', 'Dead Stock Inactivity Threshold (days)', 30, 'days', 1),
('unreconciled_upi_max_paise', 'Unreconciled UPI Alert Threshold (paise)', 100000, 'paise', 1);
