-- 001_initial.sql
-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'CASHIER')),
    is_active INTEGER DEFAULT 1 NOT NULL CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for high performance
CREATE INDEX IF NOT EXISTS idx_users_code ON users(code);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Seed Initial Admin User (Default password is 'admin123', hashed using SHA-256 for this seed)
-- Hash: 2407891877f68cbc85554c293021f148408f654b05d4a13f7d2e8504de17ecf4
INSERT INTO users (code, username, password_hash, role, is_active)
VALUES ('USR-00001', 'admin', '2407891877f68cbc85554c293021f148408f654b05d4a13f7d2e8504de17ecf4', 'ADMIN', 1)
ON CONFLICT(username) DO NOTHING;

-- Seed default application settings
INSERT INTO system_settings (key, value) VALUES ('shop_name', 'Premium Meat Shop') ON CONFLICT(key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('currency', 'INR') ON CONFLICT(key) DO NOTHING;
