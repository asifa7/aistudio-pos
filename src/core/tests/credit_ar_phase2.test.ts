import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { arReportsService } from '../../modules/customers/backend/service/ar_reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('\n=============================================================');
  console.log('   STARTING CREDIT & A/R PHASE 2 AUTOMATED TESTS');
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
    // STEP 1: Run Migrations including 051_aging_bucket_settings.sql
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations completed successfully');

    // Authenticate test admin user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Logged in as test admin user');

    // STEP 2: Create Test Customers for Credit, Aging, and Statements
    console.log('\n[STEP 2] Creating test customer for Credit & AR Phase 2...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9822${uniqueSuffix}`;

    const testCust = customerService.createCustomer({
      name: `AR Phase 2 Test Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Wholesale',
      credit_allowed: 1,
      credit_limit_paise: 1000000, // ₹10,000 credit limit
      opening_balance_paise: 0,
    });

    // Ensure credit account exists and set max_overdue_days to 120
    creditService.getCreditAccount(testCust.id);
    creditService.updateCreditAccount(testCust.id, { customer_id: testCust.id, max_overdue_days: 120 });

    assert(testCust.id > 0, `Created customer #${testCust.id} (${testCust.customer_code})`);

    // Helper to create completed credit invoice (completeInvoice automatically registers credit sale)
    function createTestCreditInvoice(qtyGrams: number) {
      const draft = invoiceService.createDraft({ customer_id: testCust.id, is_gst_invoice: false });
      invoiceService.addItem({ invoice_id: draft.id, product_variant_id: 1, quantity_grams: qtyGrams, quantity_units: null });
      const completed = invoiceService.completeInvoice({ invoiceId: draft.id });
      return completed.invoice;
    }

    // STEP 3: Create multiple credit sales on different dates to test aging buckets
    console.log('\n[STEP 3] Generating invoices across time to test aging classification...');
    
    // Invoice 1: Recent invoice (0 days ago) -> 0-15 days bucket (1kg = 22000 paise = ₹220)
    const inv1 = createTestCreditInvoice(1000);

    // Invoice 2: Backdated invoice (25 days ago) -> 16-30 days bucket (2kg = 44000 paise = ₹440)
    const inv2 = createTestCreditInvoice(2000);

    // Invoice 3: Backdated invoice (45 days ago) -> 31-60 days bucket (3kg = 66000 paise = ₹660)
    const inv3 = createTestCreditInvoice(3000);

    // Invoice 4: Backdated invoice (75 days ago) -> 60+ days bucket (4kg = 88000 paise = ₹880)
    const inv4 = createTestCreditInvoice(4000);

    // Backdate timestamps
    const date25DaysAgo = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("UPDATE invoices SET completed_at = ?, created_at = ? WHERE id = ?").run(date25DaysAgo, date25DaysAgo, inv2.id);
    db.prepare("UPDATE customer_ledger SET entry_date = ? WHERE ref_type = 'invoice' AND ref_id = ?").run(date25DaysAgo.substring(0, 10), inv2.id);

    const date45DaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("UPDATE invoices SET completed_at = ?, created_at = ? WHERE id = ?").run(date45DaysAgo, date45DaysAgo, inv3.id);
    db.prepare("UPDATE customer_ledger SET entry_date = ? WHERE ref_type = 'invoice' AND ref_id = ?").run(date45DaysAgo.substring(0, 10), inv3.id);

    const date75DaysAgo = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("UPDATE invoices SET completed_at = ?, created_at = ? WHERE id = ?").run(date75DaysAgo, date75DaysAgo, inv4.id);
    db.prepare("UPDATE customer_ledger SET entry_date = ? WHERE ref_type = 'invoice' AND ref_id = ?").run(date75DaysAgo.substring(0, 10), inv4.id);

    const totalInvoicedPaise = inv1.total_paise + inv2.total_paise + inv3.total_paise + inv4.total_paise;
    const custAfterInvoices = customerService.getCustomerById(testCust.id) as any;
    assert(custAfterInvoices.outstanding_balance_paise === totalInvoicedPaise, `Customer total outstanding is ₹${(totalInvoicedPaise/100).toFixed(2)} (${custAfterInvoices.outstanding_balance_paise} === ${totalInvoicedPaise})`);

    // STEP 4: Test Default Aging Schedule (0-15, 16-30, 31-60, 60+)
    console.log('\n[STEP 4] Testing default Aging Schedule (0-15, 16-30, 31-60, 60+)...');
    const defaultAging = arReportsService.getAgingReport();
    assert(defaultAging.buckets.length === 4, `Default aging has 4 buckets: ${defaultAging.buckets.map(b => b.label).join(', ')}`);
    assert(defaultAging.buckets[0].label === '0–15 Days', 'Bucket 0 is 0-15 Days');
    assert(defaultAging.buckets[1].label === '16–30 Days', 'Bucket 1 is 16-30 Days');
    assert(defaultAging.buckets[2].label === '31–60 Days', 'Bucket 2 is 31-60 Days');
    assert(defaultAging.buckets[3].label === '60+ Days', 'Bucket 3 is 60+ Days');

    const testCustRow = defaultAging.rows.find(r => r.customer_id === testCust.id);
    assert(testCustRow !== undefined, 'Test customer is present in Aging Report');
    if (testCustRow) {
      assert(testCustRow.outstanding_paise === totalInvoicedPaise, 'Customer outstanding matches total invoices');
      
      const bucketSum = testCustRow.bucket_values.reduce((sum, v) => sum + v, 0);
      assert(bucketSum === testCustRow.outstanding_paise, `Bucket values sum strictly equals Total Outstanding (${bucketSum} === ${testCustRow.outstanding_paise})`);
      
      assert(testCustRow.bucket_values[0] === inv1.total_paise, `Bucket 0-15d contains recent invoice amount (₹${(inv1.total_paise/100).toFixed(2)})`);
      assert(testCustRow.bucket_values[1] === inv2.total_paise, `Bucket 16-30d contains 25d invoice amount (₹${(inv2.total_paise/100).toFixed(2)})`);
      assert(testCustRow.bucket_values[2] === inv3.total_paise, `Bucket 31-60d contains 45d invoice amount (₹${(inv3.total_paise/100).toFixed(2)})`);
      assert(testCustRow.bucket_values[3] === inv4.total_paise, `Bucket 60+d contains 75d invoice amount (₹${(inv4.total_paise/100).toFixed(2)})`);
      assert(testCustRow.invoices.length === 4, 'Row contains 4 itemized drilldown invoice records');
    }

    // STEP 5: Test Configurable Aging Bucket Settings (e.g. 7, 14, 30 days)
    console.log('\n[STEP 5] Testing custom configurable Aging Settings without rebuild...');
    arReportsService.updateAgingSettings([7, 14, 30]);
    const updatedSettings = arReportsService.getAgingSettings();
    assert(JSON.stringify(updatedSettings.boundaries) === JSON.stringify([7, 14, 30]), 'Saved new aging bucket thresholds: [7, 14, 30]');

    const customAging = arReportsService.getAgingReport();
    assert(customAging.buckets[0].label === '0–7 Days', 'Reconfigured Bucket 0 is 0-7 Days');
    assert(customAging.buckets[1].label === '8–14 Days', 'Reconfigured Bucket 1 is 8-14 Days');
    assert(customAging.buckets[2].label === '15–30 Days', 'Reconfigured Bucket 2 is 15-30 Days');
    assert(customAging.buckets[3].label === '30+ Days', 'Reconfigured Bucket 3 is 30+ Days');

    const customCustRow = customAging.rows.find(r => r.customer_id === testCust.id);
    if (customCustRow) {
      const customSum = customCustRow.bucket_values.reduce((sum, v) => sum + v, 0);
      assert(customSum === customCustRow.outstanding_paise, `Custom bucket values sum strictly equals Total Outstanding (${customSum} === ${customCustRow.outstanding_paise})`);
    }

    // Restore standard default settings [15, 30, 60]
    arReportsService.updateAgingSettings([15, 30, 60]);

    // STEP 6: Test Customer Overdue Invoices Drill-down (ordered oldest to newest)
    console.log('\n[STEP 6] Testing customer overdue invoices drill-down...');
    const overdueDrilldown = arReportsService.getCustomerOverdueInvoices(testCust.id);
    assert(overdueDrilldown.customer.id === testCust.id, 'Drill-down returns correct customer profile');
    assert(overdueDrilldown.invoices.length === 4, `Drill-down returned 4 itemized invoices`);
    assert(overdueDrilldown.invoices[0].invoice_number === inv4.invoice_number, 'Oldest invoice (inv4) is first in drill-down list');
    assert(overdueDrilldown.invoices[0].days_overdue >= 74, 'Oldest invoice overdue age is >= 74 days');
    assert(overdueDrilldown.invoices[3].invoice_number === inv1.invoice_number, 'Newest invoice (inv1) is last in drill-down list');

    // STEP 7: Record Customer Payment with FIFO Allocation to test Section C & B
    console.log('\n[STEP 7] Recording customer payment with FIFO allocations...');
    const payAmountPaise = inv4.total_paise + Math.floor(inv3.total_paise / 2); // Pay oldest bill in full + half of next bill
    const payRes = creditService.recordPayment({
      customer_id: testCust.id,
      amount_paise: payAmountPaise,
      method: 'upi',
      reference_number: `UPI-REC-${uniqueSuffix}`,
      notes: 'Partial settlement against oldest invoices'
    });
    assert(payRes.success === true, `Payment of ₹${(payAmountPaise/100).toFixed(2)} recorded successfully`);
    assert(payRes.data.applied.length >= 1, `FIFO allocation applied to ${payRes.data.applied.length} invoices`);
    assert(payRes.data.applied[0].invoiceId === inv4.id, 'FIFO prioritized oldest invoice (inv4)');

    // STEP 8: Test Customer Statement (Section B)
    console.log('\n[STEP 8] Testing Customer Statement generation & balance reconciliation (Section B)...');
    const statement = arReportsService.getCustomerStatement(testCust.id, '2020-01-01', new Date().toISOString().split('T')[0]);
    assert(statement.customer.id === testCust.id, 'Statement generated for correct customer');
    assert(statement.shopInfo !== undefined && typeof statement.shopInfo.name === 'string', `Statement contains shop header: ${statement.shopInfo.name}`);
    assert(statement.opening_balance_paise === 0, 'Opening balance before 2020 is 0');
    assert(statement.total_debits_paise === totalInvoicedPaise, `Total Debits match sum of invoices (₹${(totalInvoicedPaise/100).toFixed(2)})`);
    assert(statement.total_credits_paise === payAmountPaise, `Total Credits match payment amount (₹${(payAmountPaise/100).toFixed(2)})`);
    
    const expectedClosing = totalInvoicedPaise - payAmountPaise;
    assert(statement.closing_balance_paise === expectedClosing, `Closing balance matches calculation (${statement.closing_balance_paise} === ${expectedClosing})`);
    
    const currentCustomer = customerService.getCustomerById(testCust.id) as any;
    assert(statement.closing_balance_paise === currentCustomer.outstanding_balance_paise, `Statement closing balance strictly matches live customer outstanding balance (${statement.closing_balance_paise} === ${currentCustomer.outstanding_balance_paise})`);
    assert(statement.entries.length >= 5, `Statement contains ${statement.entries.length} detailed ledger entries`);

    // STEP 9: Test Collection Reports (Section C)
    console.log('\n[STEP 9] Testing Collection Reports and payment allocations (Section C)...');
    const todayStr = new Date().toISOString().split('T')[0];
    const colReport = arReportsService.getCollectionReport({
      startDate: todayStr,
      endDate: todayStr,
      customerId: testCust.id,
      method: 'upi'
    });

    assert(colReport.total_collected_paise === payAmountPaise, `Collection total matches paid amount (₹${(payAmountPaise/100).toFixed(2)})`);
    assert(colReport.by_method.upi.total_paise === payAmountPaise, 'UPI method aggregation is accurate');
    assert(colReport.payments.length >= 1, 'Collection log contains payment entry');
    
    const loggedPayment = colReport.payments[0];
    assert(loggedPayment.customer_id === testCust.id, 'Payment entry points to test customer');
    assert(loggedPayment.allocations.length > 0, 'Payment entry includes itemized invoice allocations');
    assert(loggedPayment.allocations[0].invoice_number === inv4.invoice_number, 'Allocated invoice number matches oldest invoice');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
    process.exit(1);
  } finally {
    setTimeout(() => {
      app.quit();
      process.exit(0);
    }, 500);
  }
}

app.whenReady().then(runTests);
