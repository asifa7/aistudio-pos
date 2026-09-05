-- 056_delivery_module.sql
-- MeatPOS Delivery Module V1 Schema

-- 1. Customer Addresses (Multi-address structured book)
CREATE TABLE IF NOT EXISTS customer_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT 'Home', -- Home, Office, Store, Other
    door_no TEXT,
    building TEXT,
    street TEXT,
    area TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL DEFAULT 'Bengaluru',
    district TEXT,
    state TEXT NOT NULL DEFAULT 'Karnataka',
    pincode TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    delivery_instructions TEXT,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- 2. Delivery Zones & Rules
CREATE TABLE IF NOT EXISTS delivery_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    delivery_charge_paise INTEGER NOT NULL DEFAULT 4000, -- e.g. ₹40.00
    min_order_paise INTEGER NOT NULL DEFAULT 20000,      -- e.g. ₹200.00
    free_delivery_above_paise INTEGER DEFAULT 100000,    -- e.g. Free over ₹1,000.00
    estimated_minutes INTEGER NOT NULL DEFAULT 45,
    available_from TEXT DEFAULT '07:00',
    available_to TEXT DEFAULT '21:00',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default delivery zones
INSERT OR IGNORE INTO delivery_zones (id, name, code, description, delivery_charge_paise, min_order_paise, free_delivery_above_paise, estimated_minutes, is_default)
VALUES 
    (1, 'Central / Local (0-3 km)', 'ZONE_LOCAL', 'Immediate shop vicinity within 3 km', 3000, 20000, 80000, 30, 1),
    (2, 'Standard City (3-7 km)', 'ZONE_STANDARD', 'Suburban and city radius 3 to 7 km', 5000, 30000, 120000, 45, 0),
    (3, 'Outer Perimeter (7-15 km)', 'ZONE_OUTER', 'Extended outer radius 7 to 15 km', 9000, 50000, 200000, 75, 0);

-- 3. Delivery Drivers
CREATE TABLE IF NOT EXISTS delivery_drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    alternate_phone TEXT,
    vehicle_type TEXT NOT NULL DEFAULT 'two_wheeler', -- two_wheeler, three_wheeler, car, bicycle
    vehicle_number TEXT,
    license_number TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'assigned', 'picking_up', 'delivering', 'on_break', 'offline')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    max_concurrent_orders INTEGER NOT NULL DEFAULT 4,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- Seed default delivery drivers
INSERT OR IGNORE INTO delivery_drivers (id, name, phone, vehicle_type, vehicle_number, status)
VALUES 
    (1, 'Ramesh Kumar', '9845011223', 'two_wheeler', 'KA-01-EA-4521', 'available'),
    (2, 'Suresh Gowda', '9845022334', 'two_wheeler', 'KA-05-MN-8976', 'available'),
    (3, 'Syed Imran', '9845033445', 'two_wheeler', 'KA-03-HL-1290', 'available');

-- 4. Main Deliveries Table
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_number TEXT NOT NULL UNIQUE,
    order_id INTEGER,
    invoice_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    customer_address_id INTEGER,
    zone_id INTEGER,
    driver_id INTEGER,
    delivery_type TEXT NOT NULL DEFAULT 'immediate' CHECK(delivery_type IN ('immediate', 'scheduled', 'same_day', 'pickup', 'home', 'business')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'order_created', 'pending', 'preparing', 'ready_for_dispatch',
        'assigned', 'picked_up', 'out_for_delivery', 'arrived',
        'delivered', 'failed', 'rescheduled', 'cancelled', 'returned'
    )),
    requested_date TEXT NOT NULL,           -- YYYY-MM-DD
    time_slot_start TEXT,                  -- HH:MM
    time_slot_end TEXT,                    -- HH:MM
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    delivery_charge_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    total_paise INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cod', -- cash, upi, card, credit, cod, prepaid
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'cod_pending', 'refunded')),
    cod_expected_paise INTEGER NOT NULL DEFAULT 0,
    cod_collected_paise INTEGER NOT NULL DEFAULT 0,
    cod_variance_paise INTEGER NOT NULL DEFAULT 0,
    cod_reconciled INTEGER NOT NULL DEFAULT 0 CHECK(cod_reconciled IN (0, 1)),
    otp_code TEXT,                         -- 4-digit confirmation code
    otp_verified INTEGER NOT NULL DEFAULT 0 CHECK(otp_verified IN (0, 1)),
    special_prep_instructions TEXT,        -- Curry cut, boneless, small pieces, etc.
    customer_notes TEXT,
    internal_notes TEXT,
    estimated_minutes INTEGER DEFAULT 45,
    actual_prep_minutes INTEGER,
    actual_delivery_minutes INTEGER,
    scheduled_at DATETIME,
    dispatched_at DATETIME,
    delivered_at DATETIME,
    cancelled_at DATETIME,
    created_by INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(customer_address_id) REFERENCES customer_addresses(id),
    FOREIGN KEY(zone_id) REFERENCES delivery_zones(id),
    FOREIGN KEY(driver_id) REFERENCES delivery_drivers(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_id ON deliveries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_requested_date ON deliveries(requested_date);

-- 5. Delivery Attempts (One delivery can have multiple attempts)
CREATE TABLE IF NOT EXISTS delivery_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    driver_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    arrived_at DATETIME,
    completed_at DATETIME,
    result TEXT NOT NULL CHECK(result IN ('success', 'failed', 'rescheduled', 'customer_unavailable', 'rejected', 'wrong_address')),
    failure_reason_code TEXT, -- CUSTOMER_NOT_HOME, PHONE_UNREACHABLE, REJECTED_BAD_QUALITY, WRONG_LOCATION, CASH_UNAVAILABLE
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    FOREIGN KEY(driver_id) REFERENCES delivery_drivers(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery_id ON delivery_attempts(delivery_id);

-- 6. Delivery Status History / Strict State Machine Audit Log
CREATE TABLE IF NOT EXISTS delivery_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery_id ON delivery_status_history(delivery_id);

-- 7. Delivery COD Shift Reconciliation
CREATE TABLE IF NOT EXISTS delivery_cod_reconciliation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reconciliation_number TEXT NOT NULL UNIQUE,
    driver_id INTEGER NOT NULL,
    shift_id INTEGER,
    reconciliation_date TEXT NOT NULL, -- YYYY-MM-DD
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    total_expected_paise INTEGER NOT NULL DEFAULT 0,
    total_collected_paise INTEGER NOT NULL DEFAULT 0,
    total_variance_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'verified', 'discrepancy_resolved')),
    notes TEXT,
    verified_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(driver_id) REFERENCES delivery_drivers(id),
    FOREIGN KEY(verified_by) REFERENCES users(id)
);

-- 8. Alter Invoices table to link delivery records seamlessly
ALTER TABLE invoices ADD COLUMN is_delivery INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN delivery_charge_paise INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN delivery_id INTEGER;
