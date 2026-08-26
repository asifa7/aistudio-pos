-- Migration: Create CRM and Cash Management Tables
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    credit_limit_paise INTEGER DEFAULT 0 NOT NULL,
    current_balance_paise INTEGER DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    opening_float_paise INTEGER NOT NULL,
    actual_cash_paise INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open', 'reconciled')),
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    remarks TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
