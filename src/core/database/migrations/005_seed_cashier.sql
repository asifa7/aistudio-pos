-- 005_seed_cashier.sql
-- Seed cashier user with same default password 'admin123'
INSERT INTO users (code, username, password_hash, role, is_active)
VALUES ('USR-00002', 'cashier', '2407891877f68cbc85554c293021f148408f654b05d4a13f7d2e8504de17ecf4', 'CASHIER', 1)
ON CONFLICT(username) DO NOTHING;
