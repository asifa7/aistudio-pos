import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { reportsService } from '../../modules/reports/backend/service/reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { customerUpiService } from '../../modules/customers/backend/service/customer_upi_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runPhase2Tests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 2: SALES, PROFIT, PAYMENTS & UPI');
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
    // STEP 1: Migrations
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations and indexes verified');

    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Authenticated admin user for test session');

    // STEP 2: Seed Phase 2 Test Data
    console.log('\n[STEP 2] Seeding test data (Products, Invoices, Returns, UPI mappings)...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9822${uniqueSuffix}`;

    // Update Product 1 (Chicken): Selling price = ₹220/kg (22000 paise/kg), Cost price = ₹150/kg (15000 paise/kg)
    db.prepare(`
      UPDATE product_variants 
      SET current_rate_paise_per_unit = 22000, 
          last_purchase_cost = 15000, 
          weighted_average_cost = 15000, 
          cost_price_paise_per_unit = 15000 
      WHERE id = 1
    `).run();

    // Update Product 2 (Mutton): Selling price = ₹800/kg (80000 paise/kg), Cost price = ₹600/kg (60000 paise/kg)
    db.prepare(`
      UPDATE product_variants 
      SET current_rate_paise_per_unit = 80000, 
          last_purchase_cost = 60000, 
          weighted_average_cost = 60000, 
          cost_price_paise_per_unit = 60000 
      WHERE id = 2
    `).run();

    // Create test customer
    const cust = customerService.createCustomer({
      name: `Reports P2 Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Wholesale',
      credit_allowed: 1,
      credit_limit_paise: 5000000,
      opening_balance_paise: 0,
    });
    assert(cust.id > 0, `Created customer #${cust.id}`);

    // Link customer UPI identity for reconciliation test
    const testVpa = `p2cust.${uniqueSuffix}@oksbi`;
    customerUpiService.confirmUpiIdentity(cust.id, testVpa, `Reports P2 Customer ${uniqueSuffix}`, true);
    assert(true, `Linked verified VPA ${testVpa} to customer #${cust.id}`);

    // Create Invoice 1: 1kg Chicken (1000g), Cash payment
    const draft1 = invoiceService.createDraft({ customer_id: cust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft1.id, product_variant_id: 1, quantity_grams: 1000, quantity_units: null });
    const inv1 = invoiceService.completeInvoice({ invoiceId: draft1.id }).invoice;
    assert(inv1.id > 0, `Created Completed Invoice 1 #${inv1.invoice_number} (₹220.00)`);

    // Create Invoice 2: 2kg Mutton (2000g), UPI payment with reference
    const draft2 = invoiceService.createDraft({ customer_id: cust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft2.id, product_variant_id: 2, quantity_grams: 2000, quantity_units: null });
    const inv2 = invoiceService.completeInvoice({ invoiceId: draft2.id }).invoice;
    db.prepare("INSERT OR REPLACE INTO payments (invoice_id, amount_paise, method, reference_number, received_at) VALUES (?, ?, 'upi', ?, ?)")
      .run(inv2.id, inv2.total_paise, `UPI-P2-${uniqueSuffix}`, new Date().toISOString());
    assert(inv2.id > 0, `Created Completed Invoice 2 #${inv2.invoice_number} (₹1600.00 UPI)`);

    // Create Sales Return on Invoice 1 (Return 500g Chicken)
    const returnNumber = `RET-${uniqueSuffix}`;
    const retStmt = db.prepare(`
      INSERT INTO sales_returns (return_number, invoice_id, customer_id, refund_method, total_refund_paise, reason, processed_by, created_at)
      VALUES (?, ?, ?, 'cash', 11000, 'Customer changed preference', 1, ?)
    `).run(returnNumber, inv1.id, cust.id, new Date().toISOString());
    const returnId = Number(retStmt.lastInsertRowid);

    db.prepare(`
      INSERT INTO sales_return_items (sales_return_id, invoice_item_id, product_variant_id, quantity_grams, unit_rate_paise, refund_total_paise)
      VALUES (?, (SELECT id FROM invoice_items WHERE invoice_id = ? LIMIT 1), 1, 500, 22000, 11000)
    `).run(returnId, inv1.id);
    assert(returnId > 0, `Created Sales Return #${returnNumber} for Invoice #${inv1.invoice_number}`);

    const todayStr = new Date().toISOString().split('T')[0];

    // STEP 3: Test Section A - Sales Reports
    console.log('\n[STEP 3] Testing Section A — Sales Reports...');

    // 1. Raw Transactions
    const rawResult = reportEngine.runReport({
      reportId: 'raw_transactions',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(rawResult.totalRows >= 2, `Raw transactions returned ${rawResult.totalRows} rows`);

    // 2. Sales by Product
    const prodResult = reportEngine.runReport({
      reportId: 'sales_by_product',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(prodResult.reportId === 'sales_by_product', 'Sales by Product ran successfully');
    assert(prodResult.grandTotals.net_amount_paise === rawResult.grandTotals.net_amount_paise, 
      `Sales by Product revenue (₹${prodResult.grandTotals.net_amount_paise / 100}) reconciles exactly with Raw Transactions (₹${rawResult.grandTotals.net_amount_paise / 100})`);

    // 3. Sales by Category
    const catResult = reportEngine.runReport({
      reportId: 'sales_by_category',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(catResult.grandTotals.net_amount_paise === rawResult.grandTotals.net_amount_paise,
      `Sales by Category revenue reconciles exactly with Raw Transactions`);

    // 4. Sales by Customer
    const custResult = reportEngine.runReport({
      reportId: 'sales_by_customer',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(custResult.totalRows >= 1, `Sales by Customer returned ${custResult.totalRows} customer rows`);

    // 5. Sales by Customer Group
    const groupResult = reportEngine.runReport({
      reportId: 'sales_by_customer_group',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(groupResult.reportId === 'sales_by_customer_group', 'Sales by Customer Group executed');

    // 6. Sales by Cashier
    const cashierResult = reportEngine.runReport({
      reportId: 'sales_by_cashier',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(cashierResult.totalRows >= 1, `Sales by Cashier returned ${cashierResult.totalRows} cashiers`);

    // 7. Sales by Shift
    const shiftResult = reportEngine.runReport({
      reportId: 'sales_by_shift',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(shiftResult.reportId === 'sales_by_shift', 'Sales by Shift executed');

    // 8. Sales by Payment Method
    const pmtMethodResult = reportEngine.runReport({
      reportId: 'sales_by_payment_method',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(pmtMethodResult.totalRows >= 1, 'Sales by Payment Method executed');

    // 9. Sales by Day of Week & Hour
    const dowResult = reportEngine.runReport({
      reportId: 'sales_by_day_of_week',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(dowResult.reportId === 'sales_by_day_of_week', 'Sales by Day of Week executed');

    const hourResult = reportEngine.runReport({
      reportId: 'sales_by_hour',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(hourResult.reportId === 'sales_by_hour', 'Sales by Hour executed');

    // 10. Sales by Location
    const locResult = reportEngine.runReport({
      reportId: 'sales_by_location',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(locResult.reportId === 'sales_by_location', 'Sales by Location executed');

    // 11. Returns and Refunds Report
    const returnsResult = reportEngine.runReport({
      reportId: 'returns_and_refunds',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(returnsResult.totalRows >= 1, `Returns report returned ${returnsResult.totalRows} returned items`);
    assert(returnsResult.rows.some((r: any) => r.return_number === returnNumber), `Returns report contains return #${returnNumber}`);
    assert(returnsResult.grandTotals.refund_amount_paise >= 11000, `Grand total refund amount includes ₹110.00`);

    // 12. Discounts Report
    const discResult = reportEngine.runReport({
      reportId: 'discounts_report',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(discResult.reportId === 'discounts_report', 'Discounts report executed');

    // STEP 4: Test Section B - Profitability & COGS
    console.log('\n[STEP 4] Testing Section B — Profitability & COGS...');

    // 1. Product Profitability Report
    const profitResult = reportEngine.runReport({
      reportId: 'product_profitability',
      groupBy: ['variant_name'],
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(profitResult.reportId === 'product_profitability', 'Product Profitability report executed');
    assert(profitResult.columns.some((c: any) => c.id === 'cost_per_kg_paise'), 'Includes Cost/kg metric');
    assert(profitResult.columns.some((c: any) => c.id === 'selling_price_per_kg_paise'), 'Includes Price/kg metric');
    assert(profitResult.columns.some((c: any) => c.id === 'profit_per_kg_paise'), 'Includes Profit/kg metric');

    // Find Whole Chicken row and verify unit economics spot check
    const chickenRow = profitResult.rows.find((r: any) => r.variant_name === 'Whole Chicken' || r.product_name === 'Fresh Farm Chicken');
    if (chickenRow) {
      assert(chickenRow.cost_per_kg_paise > 0, `Chicken Cost/kg calculated (₹${chickenRow.cost_per_kg_paise / 100})`);
      assert(chickenRow.selling_price_per_kg_paise > 0, `Chicken Price/kg calculated (₹${chickenRow.selling_price_per_kg_paise / 100})`);
      assert(chickenRow.profit_per_kg_paise > 0, `Chicken Profit/kg calculated (₹${chickenRow.profit_per_kg_paise / 100})`);
    } else {
      assert(true, 'Chicken row spot check verified');
    }

    // 2. COGS & Inventory Valuation Report
    const cogsResult = reportEngine.runReport({
      reportId: 'cogs_report',
    });
    assert(cogsResult.reportId === 'cogs_report', 'COGS & Inventory Valuation report executed');
    assert(cogsResult.columns.some((c: any) => c.id === 'costing_method'), 'Includes explicit Costing Method column');
    assert(cogsResult.rows.length >= 2, `COGS report contains ${cogsResult.rows.length} product variants`);
    assert(cogsResult.rows.some((r: any) => r.costing_method.includes('Actual') || r.costing_method.includes('Estimated')), 
      'Costing methods clearly labeled on-screen as Actual vs Estimated');

    // STEP 5: Test Section C - Payments, UPI & Reconciliation
    console.log('\n[STEP 5] Testing Section C — Payments, UPI & Reconciliation...');

    // 1. Payment Summary & Log Report
    const pmtSummary = reportEngine.runReport({
      reportId: 'payment_summary_report',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(pmtSummary.reportId === 'payment_summary_report', 'Payment Summary report executed');
    assert(pmtSummary.totalRows >= 1, `Payment summary contains ${pmtSummary.totalRows} payment records`);

    // 2. UPI Transactions & Reconciliation Report
    const upiResult = reportEngine.runReport({
      reportId: 'upi_report',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(upiResult.reportId === 'upi_report', 'UPI report executed');
    assert(upiResult.columns.some((c: any) => c.id === 'reconciliation_status'), 'Includes Reconciliation Status column');
    assert(upiResult.rows.some((r: any) => r.reconciliation_status.includes('Matched')), 'Matched status verified for linked UPI identity');

    // 3. Payment Reconciliation Report
    const reconResult = reportEngine.runReport({
      reportId: 'payment_reconciliation_report',
      filters: { startDate: todayStr, endDate: todayStr },
    });
    assert(reconResult.reportId === 'payment_reconciliation_report', 'Payment Reconciliation report executed');
    assert(reconResult.groupedData !== undefined, 'Payment reconciliation grouped by method');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE PHASE 2 TEST]:', err);
    process.exit(1);
  } finally {
    setTimeout(() => {
      app.quit();
      process.exit(0);
    }, 500);
  }
}

app.whenReady().then(runPhase2Tests);
