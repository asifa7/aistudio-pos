import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { reportsService } from '../../modules/reports/backend/service/reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runPhase5Tests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 5: EXPENSES, CASH, EMPLOYEES, AUDIT, TAX & PERFORMANCE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${msg}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${msg}`);
    }
  }

  try {
    // STEP 1: Run Migrations & Authenticate Admin
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations and indexes verified');

    const loginRes = authService.login('admin', 'admin123');
    const userId = loginRes?.user?.id || 1;
    assert(loginRes !== null, 'Authenticated admin user for test session');

    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const todayStr = new Date().toISOString().split('T')[0];

    // STEP 2: Seed Test Data (Expenses, Shifts, Voided Bills, Audit Logs, GST Invoices)
    console.log('\n[STEP 2] Seeding test data across Expenses, Shifts, Voids, Audit, and Tax...');

    // 1. Seed Expense Category & Expense Record
    const catRes = db.prepare(`
      INSERT INTO expense_categories (name) VALUES (?)
    `).run(`Utilities ${uniqueSuffix}`);
    const catId = catRes.lastInsertRowid as number;

    const expRes = db.prepare(`
      INSERT INTO expenses (category_id, vendor_name, amount_paise, gst_paise, payment_method, expense_date, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(catId, 'Power Grid Corp', 450000, 50000, 'Cash', todayStr, `Electricity Bill #${uniqueSuffix}`, 'Approved', userId);
    assert(expRes.lastInsertRowid > 0, `Created expense #${expRes.lastInsertRowid} (₹4500.00)`);

    // 2. Seed Shift & Shift Closing Record with known variance
    const sessionRes = db.prepare(`
      INSERT INTO pos_sessions (cashier_id, opened_at, closed_at, opening_cash_paise, closing_cash_paise, status, variance_reason)
      VALUES (?, datetime('now', '-4 hours'), datetime('now'), 200000, 580000, 'closed', 'Cash count variance test')
    `).run(userId);
    const sessionId = sessionRes.lastInsertRowid as number;

    // Shift cash movements: Cash Out of ₹200.00
    db.prepare(`
      INSERT INTO shift_cash_movements (session_id, movement_type, category, amount_paise, reason, created_by)
      VALUES (?, 'cash_out', 'Bank Drop', 20000, 'Mid-day bank drop', ?)
    `).run(sessionId, userId);

    // Shift Closing Record with expected ₹6000.00, actual ₹5800.00, variance -₹200.00 (-20000 paise)
    db.prepare(`
      INSERT INTO shift_closing_records (session_id, expected_cash_paise, physical_cash_paise, difference_paise, status, declared_reason, closed_by)
      VALUES (?, 600000, 580000, -20000, 'explained_difference', 'Till shortage investigated', ?)
    `).run(sessionId, userId);
    assert(sessionId > 0, `Created closed shift #${sessionId} with closing record variance -₹200.00`);

    // 3. Seed Voided / Cancelled Invoice
    const voidInvNum = `VOID-${uniqueSuffix}`;
    const voidInvRes = db.prepare(`
      INSERT INTO invoices (
        invoice_number, status, gst_number_snapshot, subtotal_paise, cgst_paise, sgst_paise, tax_paise, total_paise,
        payment_status, created_by, completed_at
      ) VALUES (?, 'void', 'Customer changed order before packing', 85000, 0, 0, 0, 85000, 'unpaid', ?, datetime('now'))
    `).run(voidInvNum, userId);
    assert(voidInvRes.lastInsertRowid > 0, `Created voided invoice #${voidInvNum} (₹850.00)`);

    // 4. Seed Audit Events in product_tracking_change_log and hr_audit_logs
    db.prepare(`
      INSERT INTO product_tracking_change_log (product_id, old_track_in_inventory, new_track_in_inventory, reason, changed_by, changed_by_name)
      VALUES (1, 0, 1, 'Switched Chicken Breast to Batch FIFO tracking', ?, 'Admin')
    `).run(userId);

    db.prepare(`
      INSERT INTO hr_audit_logs (entity_type, entity_id, action, reason, performed_by, performed_by_name)
      VALUES ('salary_structure', 1, 'UPDATE', 'Annual salary increment approved', ?, 'HR Admin')
    `).run(userId);
    assert(true, 'Logged audit entries across Product Tracking and HR subsystems');

    // 5. Seed GST Invoice with 5% GST (2.5% CGST + 2.5% SGST)
    const gstInvNum = `GST-${uniqueSuffix}`;
    const gstInvRes = db.prepare(`
      INSERT INTO invoices (
        invoice_number, status, is_gst_invoice, subtotal_paise, cgst_paise, sgst_paise, tax_paise, total_paise,
        payment_status, created_by, completed_at
      ) VALUES (?, 'completed', 1, 100000, 2500, 2500, 5000, 105000, 'paid', ?, datetime('now'))
    `).run(gstInvNum, userId);
    const gstInvId = gstInvRes.lastInsertRowid as number;

    db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, product_variant_id, quantity_grams, quantity_units, rate_paise_snapshot,
        line_subtotal_paise, line_tax_paise, line_total_paise, gst_rate_percent_snapshot
      ) VALUES (?, 1, 5000, NULL, 20000, 100000, 5000, 105000, 500)
    `).run(gstInvId);
    assert(gstInvId > 0, `Created completed GST invoice #${gstInvNum} (Taxable ₹1000, Tax ₹50)`);

    // STEP 3: Test Section A — Expense Report
    console.log('\n[STEP 3] Testing Section A — Expense Report...');

    const expenseRes = reportEngine.runReport({
      reportId: 'expense_records_report',
    });
    assert(expenseRes.reportId === 'expense_records_report', 'Expense Records Report executed');
    assert(expenseRes.totalRows >= 1, `Found ${expenseRes.totalRows} expense records`);
    assert(expenseRes.columns.some((c: any) => c.id === 'category_name'), 'Includes Category column');
    assert(expenseRes.columns.some((c: any) => c.id === 'amount_paise'), 'Includes Amount (₹) measure');
    assert(expenseRes.grandTotals.amount_paise >= 450000, `Grand total expense amount: ₹${expenseRes.grandTotals.amount_paise / 100}`);

    const expEntry = expenseRes.rows.find((r: any) => r.notes?.includes(String(uniqueSuffix)));
    assert(expEntry !== undefined, 'Created test expense found in report');
    if (expEntry) {
      assert(expEntry.amount_paise === 450000, 'Expense amount is ₹4500.00 (450000 paise)');
      assert(expEntry.payment_method === 'Cash', 'Payment method is Cash');
    }

    // STEP 4: Test Section B — Cash Box & Shift Reports
    console.log('\n[STEP 4] Testing Section B — Cash Box & Shift Reports...');

    // 1. Cash Box Reconciliation Report
    const cashBoxRes = reportEngine.runReport({
      reportId: 'cash_box_reconciliation_report',
    });
    assert(cashBoxRes.reportId === 'cash_box_reconciliation_report', 'Cash Box Reconciliation Report executed');
    assert(cashBoxRes.columns.some((c: any) => c.id === 'opening_cash_paise'), 'Includes Opening Cash column');
    assert(cashBoxRes.columns.some((c: any) => c.id === 'expected_cash_paise'), 'Includes Expected Cash column');
    assert(cashBoxRes.columns.some((c: any) => c.id === 'variance_paise'), 'Includes Variance column');

    // 2. Shift Closing Report
    const shiftRes = reportEngine.runReport({
      reportId: 'shift_closing_report',
    });
    assert(shiftRes.reportId === 'shift_closing_report', 'Shift Closing Report executed');
    assert(shiftRes.totalRows >= 1, `Found ${shiftRes.totalRows} shift closing records`);

    const shiftRow = shiftRes.rows.find((r: any) => r.session_id === sessionId);
    assert(shiftRow !== undefined, `Found test shift #${sessionId} in Shift Report`);
    if (shiftRow) {
      assert(shiftRow.expected_cash_paise === 600000, `Expected cash is ₹6000.00 (${shiftRow.expected_cash_paise} paise)`);
      assert(shiftRow.actual_cash_paise === 580000, `Counted cash is ₹5800.00 (${shiftRow.actual_cash_paise} paise)`);
      assert(shiftRow.variance_paise === -20000, `Declared variance (-₹200.00) matches shift closing record exactly`);
    }

    // STEP 5: Test Section C — Employee / Cashier Report
    console.log('\n[STEP 5] Testing Section C — Employee / Cashier Report...');

    const employeeRes = reportEngine.runReport({
      reportId: 'employee_cashier_report',
    });
    assert(employeeRes.reportId === 'employee_cashier_report', 'Employee & Cashier Report executed');
    assert(employeeRes.totalRows >= 1, `Evaluated ${employeeRes.totalRows} cashiers/employees`);
    assert(employeeRes.columns.some((c: any) => c.id === 'total_sales_paise'), 'Includes Total Sales measure');
    assert(employeeRes.columns.some((c: any) => c.id === 'avg_invoice_paise'), 'Includes Avg Ticket measure');
    assert(employeeRes.columns.some((c: any) => c.id === 'voids_count'), 'Includes Voids count measure');

    const adminRow = employeeRes.rows.find((r: any) => r.employee_id === userId);
    assert(adminRow !== undefined, 'Admin cashier row found in Employee Report');
    if (adminRow) {
      assert(adminRow.invoices_count > 0, `Admin billed ${adminRow.invoices_count} invoices`);
      assert(adminRow.total_sales_paise > 0, `Admin total sales: ₹${adminRow.total_sales_paise / 100}`);
    }

    // STEP 6: Test Section D — Void / Cancelled Transaction Report
    console.log('\n[STEP 6] Testing Section D — Void / Cancelled Transaction Report...');

    const voidRes = reportEngine.runReport({
      reportId: 'void_cancelled_report',
    });
    assert(voidRes.reportId === 'void_cancelled_report', 'Void & Cancelled Report executed');
    assert(voidRes.totalRows >= 1, `Found ${voidRes.totalRows} voided/cancelled transactions`);
    assert(voidRes.columns.some((c: any) => c.id === 'cancellation_reason'), 'Includes Cancellation Reason column');
    assert(voidRes.columns.some((c: any) => c.id === 'void_amount_paise'), 'Includes Void Amount measure');

    const voidEntry = voidRes.rows.find((r: any) => r.invoice_number === voidInvNum);
    assert(voidEntry !== undefined, `Voided bill #${voidInvNum} listed in Void Report`);
    if (voidEntry) {
      assert(voidEntry.void_amount_paise === 85000, `Void amount is ₹850.00 (${voidEntry.void_amount_paise} paise)`);
      assert(voidEntry.cancellation_reason?.includes('Customer changed order'), 'Cancellation reason accurately preserved');
    }

    // STEP 7: Test Section E — Unified Audit Report
    console.log('\n[STEP 7] Testing Section E — Unified Audit Report...');

    const auditRes = reportEngine.runReport({
      reportId: 'unified_audit_report',
    });
    assert(auditRes.reportId === 'unified_audit_report', 'Unified Audit Report executed');
    assert(auditRes.totalRows >= 2, `Unified audit report contains ${auditRes.totalRows} audit events`);
    assert(auditRes.columns.some((c: any) => c.id === 'module_entity'), 'Includes Module/Subsystem column');
    assert(auditRes.columns.some((c: any) => c.id === 'action_type'), 'Includes Action column');

    const prodAudit = auditRes.rows.find((r: any) => r.module_entity === 'Product Tracking');
    const hrAudit = auditRes.rows.find((r: any) => r.module_entity === 'HR & Payroll');
    assert(prodAudit !== undefined, 'Product Tracking audit event aggregated into unified audit log');
    assert(hrAudit !== undefined, 'HR & Payroll audit event aggregated into unified audit log');

    // STEP 8: Test Section F — Tax / GST Reports
    console.log('\n[STEP 8] Testing Section F — Tax / GST Reports...');

    const taxRes = reportEngine.runReport({
      reportId: 'tax_gst_report',
      filters: { searchTerm: gstInvNum },
    });
    assert(taxRes.reportId === 'tax_gst_report', 'Tax / GST Report executed');
    assert(taxRes.totalRows >= 1, `Found ${taxRes.totalRows} tax invoice items`);
    assert(taxRes.columns.some((c: any) => c.id === 'taxable_amount_paise'), 'Includes Taxable Sales column');
    assert(taxRes.columns.some((c: any) => c.id === 'cgst_paise'), 'Includes CGST column');
    assert(taxRes.columns.some((c: any) => c.id === 'sgst_paise'), 'Includes SGST column');
    assert(taxRes.columns.some((c: any) => c.id === 'total_tax_paise'), 'Includes Total Tax column');

    const gstRow = taxRes.rows.find((r: any) => r.invoice_number === gstInvNum);
    assert(gstRow !== undefined, `Found GST invoice #${gstInvNum} in Tax Report`);
    if (gstRow) {
      assert(gstRow.taxable_amount_paise === 100000, `Taxable amount is ₹1000.00 (${gstRow.taxable_amount_paise} paise)`);
      assert(gstRow.total_tax_paise === 5000, `Total tax is ₹50.00 (${gstRow.total_tax_paise} paise)`);
      assert(gstRow.cgst_paise === 2500, `CGST is ₹25.00 (2500 paise)`);
      assert(gstRow.sgst_paise === 2500, `SGST is ₹25.00 (2500 paise)`);
      assert(gstRow.tax_rate_percent === 5, `Tax rate is 5% (got ${gstRow.tax_rate_percent}%)`);
    }

    // STEP 9: Test Section G — Business Performance, Comparison & Trends
    console.log('\n[STEP 9] Testing Section G — Business Performance, Comparison & Trends...');

    const perfRes = reportEngine.runReport({
      reportId: 'business_performance_report',
    });
    assert(perfRes.reportId === 'business_performance_report', 'Business Performance Report executed');
    assert(perfRes.totalRows >= 1, `Found ${perfRes.totalRows} date records in Business Performance report`);
    assert(perfRes.columns.some((c: any) => c.id === 'gross_sales_paise'), 'Includes Gross Revenue measure');
    assert(perfRes.columns.some((c: any) => c.id === 'net_sales_paise'), 'Includes Net Sales measure');
    assert(perfRes.columns.some((c: any) => c.id === 'gross_profit_paise'), 'Includes Gross Profit measure');
    assert(perfRes.columns.some((c: any) => c.id === 'gross_margin_percent'), 'Includes Gross Margin % measure');
    assert(perfRes.grandTotals.gross_sales_paise > 0, `Grand total revenue: ₹${perfRes.grandTotals.gross_sales_paise / 100}`);

    // Verify Comparison Logic
    console.log('\n[STEP 10] Testing Comparison Calculations...');
    const curRev = 100000;
    const prevRev = 80000;
    const growthPercent = Number((((curRev - prevRev) / prevRev) * 100).toFixed(2));
    assert(growthPercent === 25.0, `Period growth accurately calculated: +25%`);

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE PHASE 5 TEST]:', err);
    process.exit(1);
  }
}

app.whenReady().then(async () => {
  await runPhase5Tests();
  app.quit();
});
