-- Migration 044: HR Phase 4 - Salary Cycles, Flexible Date Ranges, Past Attendance Edits, and Relieving Settlement

-- 1. Add salary cycle and relieving fields to employees table
ALTER TABLE employees ADD COLUMN salary_cycle TEXT NOT NULL DEFAULT 'Monthly';
ALTER TABLE employees ADD COLUMN salary_cycle_start_day TEXT DEFAULT 'Monday';
ALTER TABLE employees ADD COLUMN relieving_date DATE DEFAULT NULL;
ALTER TABLE employees ADD COLUMN relieving_reason TEXT DEFAULT NULL;
ALTER TABLE employees ADD COLUMN relieving_settled INTEGER NOT NULL DEFAULT 0;

-- 2. Add change tracking fields to employee_attendance
ALTER TABLE employee_attendance ADD COLUMN is_modified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee_attendance ADD COLUMN modified_reason TEXT DEFAULT NULL;
ALTER TABLE employee_attendance ADD COLUMN modified_at DATETIME DEFAULT NULL;
ALTER TABLE employee_attendance ADD COLUMN modified_by INTEGER DEFAULT NULL;

-- 3. Add flexible period date range fields to payroll_runs & payroll_items
ALTER TABLE payroll_runs ADD COLUMN start_date DATE DEFAULT NULL;
ALTER TABLE payroll_runs ADD COLUMN end_date DATE DEFAULT NULL;
ALTER TABLE payroll_runs ADD COLUMN cycle_type TEXT NOT NULL DEFAULT 'Monthly';

ALTER TABLE payroll_items ADD COLUMN start_date DATE DEFAULT NULL;
ALTER TABLE payroll_items ADD COLUMN end_date DATE DEFAULT NULL;
ALTER TABLE payroll_items ADD COLUMN cycle_type TEXT NOT NULL DEFAULT 'Monthly';

-- 4. Create index for fast attendance date range lookups
CREATE INDEX IF NOT EXISTS idx_employee_attendance_emp_date ON employee_attendance(employee_id, date);
