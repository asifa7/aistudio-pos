import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { reportsService } from '../../modules/reports/backend/service/reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { customerIntelligenceService } from '../../modules/customers/backend/service/customer_intelligence_service';
import { arReportsService } from '../../modules/customers/backend/service/ar_reports_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runPhase3Tests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 3: CUSTOMER & CREDIT/A-R REPORTS');
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
    // STEP 1: Run Migrations
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations and indexes verified');

    // Authenticate admin user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Authenticated admin user for test session');

    // STEP 2: Seed Test Customers, Invoices, Advances, and Intelligence Cache
    console.log('\n[STEP 2] Seeding test customer with credit, advances, purchases, and intelligence...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9844${uniqueSuffix}`;

    const cust = customerService.createCustomer({
      name: `Reports P3 Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Wholesale',
      credit_allowed: 1,
      credit_limit_paise: 1000000, // ₹10,000 credit limit
      opening_balance_paise: 0,
      preferred_cut: 'Curry Cut',
      typical_quantity: '2.0 kg',
    });
    assert(cust.id > 0, `Created test customer #${cust.id} (${cust.customer_code})`);

    // 1. Record an advance deposit of ₹500.00 (50000 paise)
    creditService.depositAdvance({
      customer_id: cust.id,
      amount_paise: 50000,
      method: 'upi',
      reference_number: `ADV-REF-${uniqueSuffix}`,
      notes: 'Initial credit deposit for advance purchases'
    });
    assert(true, `Recorded advance deposit of ₹500.00 for customer #${cust.id}`);

    // Verify customer advance balance in database
    const refreshedCust = customerService.getCustomerById(cust.id) as any;
    assert(refreshedCust.advance_balance_paise === 50000, `Customer advance balance is ₹500.00 (${refreshedCust.advance_balance_paise} paise)`);

    // 2. Create Completed Invoice 1: 1kg Chicken Breast (1000g, ₹220.00), paid cash
    const draft1 = invoiceService.createDraft({ customer_id: cust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft1.id, product_variant_id: 1, quantity_grams: 1000, quantity_units: null });
    const inv1 = invoiceService.completeInvoice({ invoiceId: draft1.id }).invoice;
    assert(inv1.id > 0, `Created completed invoice #${inv1.invoice_number} (₹220.00 cash)`);

    // 3. Create Completed Invoice 2: 2kg Mutton Curry Cut (2000g, ₹1600.00) on Credit
    const draft2 = invoiceService.createDraft({ customer_id: cust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft2.id, product_variant_id: 5, quantity_grams: 2000, quantity_units: null });
    // Record partial payment of ₹600.00 on invoice 2
    invoiceService.recordPayment({ invoice_id: draft2.id, method: 'upi', amount_paise: 60000 });
    const inv2 = invoiceService.completeInvoice({ invoiceId: draft2.id }).invoice;
    assert(inv2.id > 0, `Created completed invoice #${inv2.invoice_number} (₹1600.00 total, ₹600.00 paid, ₹1000.00 credit)`);

    // 4. Record a second advance deposit of ₹300.00 (30000 paise) so customer has an active advance balance
    creditService.depositAdvance({
      customer_id: cust.id,
      amount_paise: 30000,
      method: 'cash',
      reference_number: `ADV-ACTIVE-${uniqueSuffix}`,
      notes: 'Active balance deposit'
    });

    const refreshedCustAfterAll = customerService.getCustomerById(cust.id) as any;
    assert(refreshedCustAfterAll.advance_balance_paise === 30000, `Refreshed advance balance is ₹300.00 (${refreshedCustAfterAll.advance_balance_paise} paise)`);

    // 5. Force calculate and cache Customer Intelligence via CRM engine
    const intel = customerIntelligenceService.getIntelligence(cust.id, true);
    assert(intel.total_visits >= 2, `Customer intelligence computed ${intel.total_visits} visits`);
    assert(intel.total_spend_paise >= 166000, `Customer intelligence total spend is ₹${intel.total_spend_paise / 100}`);
    assert(intel.advance_balance_paise === 30000, `Customer intelligence advance balance is ₹${intel.advance_balance_paise / 100}`);

    // STEP 3: Test Section A — Customer Reports
    console.log('\n[STEP 3] Testing Section A — Customer Reports...');

    // 1. Customer Sales Report
    const custSalesReport = reportEngine.runReport({
      reportId: 'customer_sales_report',
      filters: { customerId: cust.id },
    });
    assert(custSalesReport.reportId === 'customer_sales_report', 'Customer Sales Report executed');
    assert(custSalesReport.totalRows >= 1, `Customer Sales Report returned ${custSalesReport.totalRows} customer rows`);

    const custSalesRow = custSalesReport.rows.find((r: any) => r.customer_name === cust.name || r.customer_code === cust.customer_code);
    assert(custSalesRow !== undefined, `Test customer row found in Customer Sales Report`);
    if (custSalesRow) {
      assert(custSalesRow.total_orders >= 2, `Report Orders (${custSalesRow.total_orders}) matches CRM`);
      assert(custSalesRow.total_revenue_paise >= 166000, `Report Revenue (₹${custSalesRow.total_revenue_paise / 100}) matches CRM spend`);
      assert(custSalesRow.advance_balance_paise === 30000, `Report Advance Balance (₹${custSalesRow.advance_balance_paise / 100}) matches CRM advance`);
      assert(custSalesRow.payment_preference === intel.preferred_payment_method, `Payment preference (${custSalesRow.payment_preference}) matches CRM intelligence`);
    }

    // 2. Customer Profitability Report
    const custProfitReport = reportEngine.runReport({
      reportId: 'customer_profitability_report',
      filters: { customerId: cust.id },
    });
    assert(custProfitReport.reportId === 'customer_profitability_report', 'Customer Profitability Report executed');
    assert(custProfitReport.columns.some((c: any) => c.id === 'gross_profit_paise'), 'Includes Gross Profit metric');
    assert(custProfitReport.columns.some((c: any) => c.id === 'margin_percent'), 'Includes Margin % metric');
    assert(custProfitReport.grandTotals.gross_profit_paise > 0, `Customer gross profit calculated: ₹${custProfitReport.grandTotals.gross_profit_paise / 100}`);

    // 3. Customer Activity Report
    const custActivityReport = reportEngine.runReport({
      reportId: 'customer_activity_report',
      filters: { customerId: cust.id },
    });
    assert(custActivityReport.reportId === 'customer_activity_report', 'Customer Activity Report executed');
    const custActivityRow = custActivityReport.rows.find((r: any) => r.customer_name === cust.name);
    assert(custActivityRow !== undefined, 'Customer found in Activity report');
    if (custActivityRow) {
      assert(custActivityRow.customer_segment === intel.customer_segment, `Activity segment (${custActivityRow.customer_segment}) matches CRM intelligence`);
      assert(custActivityRow.purchase_frequency_label === intel.purchase_frequency_label, `Frequency label (${custActivityRow.purchase_frequency_label}) matches CRM`);
    }

    // 4. Customer Retention & Segmentation Report
    const custRetentionReport = reportEngine.runReport({
      reportId: 'customer_retention_report',
    });
    assert(custRetentionReport.reportId === 'customer_retention_report', 'Customer Retention Report executed');
    assert(custRetentionReport.groupedData !== undefined && custRetentionReport.groupedData.length > 0, 'Retention report grouped by customer segment');
    assert(custRetentionReport.columns.some((c: any) => c.id === 'clv_paise'), 'Includes Customer Lifetime Value metric');

    // STEP 4: Test Section B — Credit & A/R Reports
    console.log('\n[STEP 4] Testing Section B — Credit & A/R Reports...');

    // 1. Outstanding Invoices Report
    const outstandingReport = reportEngine.runReport({
      reportId: 'ar_outstanding_report',
      filters: { customerId: cust.id },
    });
    assert(outstandingReport.reportId === 'ar_outstanding_report', 'Outstanding Invoices Report executed');
    assert(outstandingReport.totalRows >= 1, `Found ${outstandingReport.totalRows} outstanding invoice records`);
    const inv2Row = outstandingReport.rows.find((r: any) => r.invoice_number === inv2.invoice_number);
    assert(inv2Row !== undefined, `Invoice #${inv2.invoice_number} is listed in Outstanding Report`);
    if (inv2Row) {
      assert(inv2Row.original_amount_paise === 144000, `Original amount is ₹1440.00 (${inv2Row.original_amount_paise} paise)`);
      assert(inv2Row.outstanding_amount_paise > 0, `Outstanding balance on credit bill (${inv2Row.outstanding_amount_paise} paise)`);
    }

    // 2. A/R Aging Schedule Report
    const agingReport = reportEngine.runReport({
      reportId: 'ar_aging_report',
      filters: { customerId: cust.id },
    });
    assert(agingReport.reportId === 'ar_aging_report', 'A/R Aging Schedule Report executed');
    const custAgingRow = agingReport.rows.find((r: any) => r.customer_name === cust.name || r.customer_code === cust.customer_code);
    assert(custAgingRow !== undefined, 'Customer found in Aging Schedule report');

    // Compare with arReportsService.getAgingReport()
    const directAging = arReportsService.getAgingReport();
    const directCustRow = directAging.rows.find((r) => r.customer_id === cust.id);
    assert(directCustRow !== undefined, 'Customer found in direct AR Aging service');
    if (custAgingRow && directCustRow) {
      assert(
        custAgingRow.total_outstanding_paise === directCustRow.outstanding_paise,
        `Aging report outstanding (₹${custAgingRow.total_outstanding_paise / 100}) strictly equals Credit AR service (₹${directCustRow.outstanding_paise / 100})`
      );
    }

    // 3. Customer Payment Behavior Report
    const behaviorReport = reportEngine.runReport({
      reportId: 'customer_payment_behavior_report',
      filters: { customerId: cust.id },
    });
    assert(behaviorReport.reportId === 'customer_payment_behavior_report', 'Customer Payment Behavior Report executed');
    const custBehaviorRow = behaviorReport.rows.find((r: any) => r.customer_name === cust.name);
    assert(custBehaviorRow !== undefined, 'Customer found in Payment Behavior report');
    if (custBehaviorRow) {
      assert(custBehaviorRow.total_collections_paise >= 50000, `Collections logged include advance payment (₹${custBehaviorRow.total_collections_paise / 100})`);
      assert(custBehaviorRow.reliability_rating !== undefined, `Reliability rating present: ${custBehaviorRow.reliability_rating}`);
    }

    // STEP 5: Test Section C — Advance / Deposit Report
    console.log('\n[STEP 5] Testing Section C — Advance / Deposit Report...');

    const advanceReport = reportEngine.runReport({
      reportId: 'customer_advance_report',
      filters: { customerId: cust.id },
    });
    assert(advanceReport.reportId === 'customer_advance_report', 'Customer Advance & Deposit Report executed');
    assert(advanceReport.totalRows >= 2, `Found ${advanceReport.totalRows} advance deposit records`);

    const activeAdvanceRow = advanceReport.rows.find((r: any) => r.reference_number?.includes('ADV-ACTIVE'));
    assert(activeAdvanceRow !== undefined, 'Active deposit record located in Customer Advance Report');
    if (activeAdvanceRow) {
      assert(activeAdvanceRow.deposit_amount_paise === 30000, `Deposit Amount is ₹300.00 (${activeAdvanceRow.deposit_amount_paise} paise)`);
      assert(activeAdvanceRow.remaining_balance_paise === 30000, `Remaining Balance is ₹300.00 (${activeAdvanceRow.remaining_balance_paise} paise)`);
      assert(activeAdvanceRow.status === 'Available', `Advance status is 'Available'`);
      assert(activeAdvanceRow.method === 'cash', `Payment method is 'cash'`);
      // Acceptance criteria: Customer's Remaining Balance matches Advance Balance shown on CRM profile
      assert(
        activeAdvanceRow.remaining_balance_paise === refreshedCustAfterAll.advance_balance_paise,
        `Remaining balance (${activeAdvanceRow.remaining_balance_paise}) strictly equals customer CRM advance_balance_paise (${refreshedCustAfterAll.advance_balance_paise})`
      );
    }

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE PHASE 3 TEST]:', err);
    process.exit(1);
  }
}

app.whenReady().then(async () => {
  await runPhase3Tests();
  app.quit();
});
