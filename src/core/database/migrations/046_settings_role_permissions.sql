-- 046_settings_role_permissions.sql
-- Create role permissions table for enterprise POS access control
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1 CHECK(allowed IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, permission_key)
);

-- Index for fast role-based permission lookup
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Seed default permissions for ADMIN
INSERT INTO role_permissions (role, permission_key, allowed) VALUES
('ADMIN', 'create_bill', 1),
('ADMIN', 'cancel_bill', 1),
('ADMIN', 'refund', 1),
('ADMIN', 'apply_discount', 1),
('ADMIN', 'change_selling_price', 1),
('ADMIN', 'edit_inventory', 1),
('ADMIN', 'create_purchase', 1),
('ADMIN', 'create_expense', 1),
('ADMIN', 'modify_cashbox', 1),
('ADMIN', 'view_reports', 1),
('ADMIN', 'change_settings', 1)
ON CONFLICT(role, permission_key) DO NOTHING;

-- Seed default permissions for MANAGER
INSERT INTO role_permissions (role, permission_key, allowed) VALUES
('MANAGER', 'create_bill', 1),
('MANAGER', 'cancel_bill', 1),
('MANAGER', 'refund', 1),
('MANAGER', 'apply_discount', 1),
('MANAGER', 'change_selling_price', 1),
('MANAGER', 'edit_inventory', 1),
('MANAGER', 'create_purchase', 1),
('MANAGER', 'create_expense', 1),
('MANAGER', 'modify_cashbox', 1),
('MANAGER', 'view_reports', 1),
('MANAGER', 'change_settings', 0)
ON CONFLICT(role, permission_key) DO NOTHING;

-- Seed default permissions for CASHIER
INSERT INTO role_permissions (role, permission_key, allowed) VALUES
('CASHIER', 'create_bill', 1),
('CASHIER', 'cancel_bill', 0),
('CASHIER', 'refund', 0),
('CASHIER', 'apply_discount', 1),
('CASHIER', 'change_selling_price', 0),
('CASHIER', 'edit_inventory', 0),
('CASHIER', 'create_purchase', 0),
('CASHIER', 'create_expense', 0),
('CASHIER', 'modify_cashbox', 0),
('CASHIER', 'view_reports', 0),
('CASHIER', 'change_settings', 0)
ON CONFLICT(role, permission_key) DO NOTHING;
