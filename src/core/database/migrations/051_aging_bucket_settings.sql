-- 051_aging_bucket_settings.sql
-- Seed default aging bucket boundaries (0-15, 16-30, 31-60, 60+)
INSERT INTO system_settings (key, value) VALUES ('aging_bucket_boundaries', '15,30,60') ON CONFLICT(key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('aging_include_unbilled_credits', '1') ON CONFLICT(key) DO NOTHING;
