import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { customerIntelligenceService } from '../../modules/customers/backend/service/customer_intelligence_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('\n=============================================================');
  console.log('   STARTING CUSTOMER INTELLIGENCE ENGINE PHASE 2 TESTS');
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
    console.log('[STEP 1] Running migrations including 049_customer_intelligence_cache.sql...');
    migrationEngine.run();
    assert(true, 'Migrations completed successfully');

    // Authenticate test user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Logged in as test admin user');

    // STEP 2: Create Test Customer with controlled purchase cadence
    console.log('\n[STEP 2] Creating test customer and simulated purchase history...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9822${uniqueSuffix}`;

    const testCust = customerService.createCustomer({
      name: `Intelligence Test Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Retail',
      preferred_cut: 'Boneless',
      skin_preference: 'No Skin',
      cutting_preference: 'Curry Cut',
      typical_quantity: '1.0 kg',
    });

    assert(testCust.id > 0, `Created test customer #${testCust.id}`);

    // Check initial intelligence for new customer with 0 purchases
    const initialIntel = customerIntelligenceService.getIntelligence(testCust.id, true);
    assert(initialIntel.total_visits === 0, 'Initial total_visits is 0');
    assert(initialIntel.purchase_frequency_label === 'No Purchases', 'Initial frequency is "No Purchases"');
    assert(initialIntel.customer_segment === 'New', 'Initial segment is "New"');

    // STEP 3: Simulate 6 purchases spaced over 35 days (every 7 days = Weekly cadence)
    console.log('\n[STEP 3] Simulating 6 spaced invoice purchases (7-day intervals)...');
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Dates: -35 days, -28 days, -21 days, -14 days, -7 days, -1 day
    const intervalsDaysAgo = [35, 28, 21, 14, 7, 1];
    const createdInvoiceIds: number[] = [];

    for (let idx = 0; idx < intervalsDaysAgo.length; idx++) {
      const daysAgo = intervalsDaysAgo[idx];
      const invDate = new Date(nowMs - daysAgo * dayMs).toISOString();

      // Create draft invoice
      const draft = invoiceService.createDraft({
        customer_id: testCust.id,
        is_gst_invoice: false,
      });

      // Add item (e.g. 1000g of variant 1)
      invoiceService.addItem({
        invoice_id: draft.id,
        product_variant_id: 1,
        quantity_grams: 1000,
        quantity_units: null,
      });

      // Fetch draft details to get line total
      const draftDetail = invoiceService.getInvoice(draft.id);
      const itemTotal = draftDetail.items.reduce((sum: number, it: any) => sum + it.line_total_paise, 0);

      // Record payment & complete invoice
      invoiceService.recordPayment({
        invoice_id: draft.id,
        amount_paise: itemTotal,
        method: idx % 2 === 0 ? 'upi' : 'cash',
      });

      const completed = invoiceService.completeInvoice({
        invoiceId: draft.id,
      });

      // Backdate the invoice created_at in SQLite for interval calculation test
      db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(invDate, completed.invoice.id);
      createdInvoiceIds.push(completed.invoice.id);
    }

    assert(createdInvoiceIds.length === 6, 'Created 6 completed invoices with controlled historical timestamps');

    // STEP 4: Calculate & Verify Intelligence Metrics
    console.log('\n[STEP 4] Verifying visit intervals, expected visit date, and favorite products...');
    const intel = customerIntelligenceService.calculateAndCache(testCust.id);

    assert(intel.total_visits === 6, `Total visits is 6 (got ${intel.total_visits})`);
    assert(intel.total_spend_paise > 0, `Total spend is > 0 (₹${intel.total_spend_paise / 100})`);
    assert(intel.average_bill_paise > 0, `Average bill is > 0 (₹${intel.average_bill_paise / 100})`);

    // Verify average visit interval is 6.8 to 7.0 days
    assert(
      intel.average_visit_interval !== null && intel.average_visit_interval >= 6.5 && intel.average_visit_interval <= 7.5,
      `Average visit interval is ~7.0 days (calculated: ${intel.average_visit_interval} days)`
    );

    // Verify median visit interval
    assert(
      intel.median_visit_interval !== null && intel.median_visit_interval >= 6.5 && intel.median_visit_interval <= 7.5,
      `Median visit interval is ~7.0 days (calculated: ${intel.median_visit_interval} days)`
    );

    // Verify purchase frequency label
    assert(intel.purchase_frequency_label === 'Weekly', `Purchase frequency label is "Weekly" (got "${intel.purchase_frequency_label}")`);

    // Verify expected next visit date
    assert(intel.expected_next_visit !== null, `Expected next visit date is computed: ${intel.expected_next_visit}`);
    assert(intel.days_since_last_purchase !== null && intel.days_since_last_purchase <= 2, `Days since last purchase is ~1d (got ${intel.days_since_last_purchase}d)`);

    // Verify favorite products & typical basket
    assert(intel.favorite_products.length >= 1, `Favorite products list contains ${intel.favorite_products.length} items`);
    assert(intel.favorite_products[0].purchase_count === 6, `Favorite product purchased 6 times`);
    assert(intel.typical_basket.length >= 1, `Typical basket generated with ${intel.typical_basket.length} items`);
    assert(intel.typical_basket_summary.length > 0, `Typical basket summary: "${intel.typical_basket_summary}"`);

    // Verify customer segmentation
    assert(intel.customer_segment === 'Regular', `Customer correctly classified as segment "Regular" (got "${intel.customer_segment}")`);
    assert(intel.segment_health_summary.includes('Healthy Regular'), `Health summary: "${intel.segment_health_summary}"`);

    // STEP 5: Test Segmentation Progression (Due -> At Risk -> Inactive)
    console.log('\n[STEP 5] Testing automated segmentation progression over time...');
    
    // Simulate 12 days elapsed since last purchase: [46d, 39d, 32d, 25d, 18d, 12d] (7 * 1.7 = Due)
    const dueDays = [46, 39, 32, 25, 18, 12];
    dueDays.forEach((d, idx) => {
      db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(new Date(nowMs - d * dayMs).toISOString(), createdInvoiceIds[idx]);
    });
    const dueIntel = customerIntelligenceService.computeCustomerIntelligence(testCust.id);
    assert(dueIntel.customer_segment === 'Due', `12 days elapsed -> Segment transitioned to "Due" (got "${dueIntel.customer_segment}")`);

    // Simulate 20 days elapsed since last purchase: [54d, 47d, 40d, 33d, 26d, 20d] (7 * 2.8 = At Risk)
    const atRiskDays = [54, 47, 40, 33, 26, 20];
    atRiskDays.forEach((d, idx) => {
      db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(new Date(nowMs - d * dayMs).toISOString(), createdInvoiceIds[idx]);
    });
    const atRiskIntel = customerIntelligenceService.computeCustomerIntelligence(testCust.id);
    assert(atRiskIntel.customer_segment === 'At Risk', `20 days elapsed -> Segment transitioned to "At Risk" (got "${atRiskIntel.customer_segment}")`);

    // Simulate 65 days elapsed since last purchase: [99d, 92d, 85d, 78d, 71d, 65d] (> 60 days = Inactive)
    const inactiveDays = [99, 92, 85, 78, 71, 65];
    inactiveDays.forEach((d, idx) => {
      db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(new Date(nowMs - d * dayMs).toISOString(), createdInvoiceIds[idx]);
    });
    const inactiveIntel = customerIntelligenceService.computeCustomerIntelligence(testCust.id);
    assert(inactiveIntel.customer_segment === 'Inactive', `65 days elapsed -> Segment transitioned to "Inactive" (got "${inactiveIntel.customer_segment}")`);

    // Restore invoices back to [35d, 28d, 21d, 14d, 7d, 1d]
    intervalsDaysAgo.forEach((d, idx) => {
      db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(new Date(nowMs - d * dayMs).toISOString(), createdInvoiceIds[idx]);
    });

    // STEP 6: Test Analytics Cache Persistence
    console.log('\n[STEP 6] Testing analytics cache table persistence...');
    customerIntelligenceService.calculateAndCache(testCust.id);
    const cachedRow = db.prepare("SELECT segment, metrics_json, last_calculated_at FROM customer_analytics_cache WHERE customer_id = ?").get(testCust.id) as any;
    assert(cachedRow != null, 'Analytics cache row found in customer_analytics_cache');
    assert(cachedRow.segment === 'Regular', `Cached segment is "Regular" (got "${cachedRow.segment}")`);

    const cachedIntel = customerIntelligenceService.getIntelligence(testCust.id);
    assert(cachedIntel.total_visits === 6, 'Retrieved intelligence from cache with total_visits === 6');

    // STEP 7: Test Event-driven Cache Refresh on New Transaction
    console.log('\n[STEP 7] Testing event-driven recalculation on transaction...');
    // Create new 7th invoice
    const draft7 = invoiceService.createDraft({ customer_id: testCust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft7.id, product_variant_id: 1, quantity_grams: 1000, quantity_units: null });
    const draft7Detail = invoiceService.getInvoice(draft7.id);
    const item7Total = draft7Detail.items.reduce((sum: number, it: any) => sum + it.line_total_paise, 0);
    invoiceService.recordPayment({ invoice_id: draft7.id, amount_paise: item7Total, method: 'cash' });
    invoiceService.completeInvoice({ invoiceId: draft7.id });

    // The cache should have been refreshed automatically by completeInvoice hook
    const refCached = customerIntelligenceService.getIntelligence(testCust.id);
    assert(refCached.total_visits === 7, `Event hook automatically updated cache to 7 visits (got ${refCached.total_visits})`);

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (app && app.quit) {
      app.quit();
    }
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    if (app && app.quit) {
      app.quit();
    }
    process.exit(1);
  }
}

if (app && app.whenReady) {
  app.whenReady().then(runTests);
} else {
  runTests();
}
