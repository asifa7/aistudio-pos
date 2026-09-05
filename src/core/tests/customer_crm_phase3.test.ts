import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { customerIntelligenceService } from '../../modules/customers/backend/service/customer_intelligence_service';
import { customerUpiService } from '../../modules/customers/backend/service/customer_upi_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('\n=============================================================');
  console.log('   STARTING CUSTOMER CRM PHASE 3 AUTOMATED TESTS');
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
    // STEP 1: Run Migrations including 050_customer_upi_identities.sql
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations completed successfully');

    // Authenticate test admin user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Logged in as test admin user');

    // STEP 2: Create Test Customer for UPI Matching & Timeline
    console.log('\n[STEP 2] Creating test customer for Phase 3...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9833${uniqueSuffix}`;

    const testCust = customerService.createCustomer({
      name: `UPI Test Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Retail',
      preferred_cut: 'Curry Cut',
      skin_preference: 'Skin On',
    });

    assert(testCust.id > 0, `Created customer #${testCust.id} (${testCust.customer_code})`);

    // STEP 3: Test UPI Payment Matching Engine
    console.log('\n[STEP 3] Testing UPI payment matching engine...');

    // 3a. Phone extracted from VPA
    const phoneVpa = `${testPhone}@paytm`;
    const matchByPhone = customerUpiService.matchUpiPayment({
      vpa: phoneVpa,
      amount_paise: 50000,
    });

    assert(matchByPhone.has_match === true, 'UPI Match found for phone-embedded VPA');
    assert(matchByPhone.best_match?.customer_id === testCust.id, 'Best match points to test customer');
    assert(matchByPhone.best_match?.confidence_score === 88, `Confidence score is 88% (got ${matchByPhone.best_match?.confidence_score}%)`);

    // 3b. Name similarity match
    const matchByName = customerUpiService.matchUpiPayment({
      payer_name: `UPI Test Customer ${uniqueSuffix}`,
      amount_paise: 25000,
    });
    assert(matchByName.has_match === true, 'UPI Match found for exact payer name');
    assert(matchByName.best_match?.customer_id === testCust.id, 'Payer name match points to test customer');
    assert(matchByName.best_match?.confidence_score === 80, `Name confidence score is 80% (got ${matchByName.best_match?.confidence_score}%)`);

    // 3c. Confirm VPA identity mapping
    console.log('\n[STEP 4] Confirming VPA identity mapping...');
    const customVpa = `rahul.meat.${uniqueSuffix}@okhdfcbank`;
    const confirmedIdentity = customerUpiService.confirmUpiIdentity(testCust.id, customVpa, `Rahul ${uniqueSuffix}`, false);

    assert(confirmedIdentity.customer_id === testCust.id, 'VPA identity saved for customer');
    assert(confirmedIdentity.verified_count === 1, 'Initial verified count is 1');

    // 3d. Match by confirmed VPA (Exact VPA High Confidence Match >= 90%)
    const matchByVpa = customerUpiService.matchUpiPayment({
      vpa: customVpa,
      amount_paise: 35000,
    });
    assert(matchByVpa.has_match === true, 'UPI Match found for confirmed VPA');
    assert(matchByVpa.best_match?.customer_id === testCust.id, 'Confirmed VPA points to test customer');
    assert(matchByVpa.best_match!.confidence_score >= 90, `Confirmed VPA confidence score is >= 90% (got ${matchByVpa.best_match?.confidence_score}%)`);

    // Increment verified count on repeat confirmation
    customerUpiService.confirmUpiIdentity(testCust.id, customVpa, `Rahul ${uniqueSuffix}`, false);
    customerUpiService.confirmUpiIdentity(testCust.id, customVpa, `Rahul ${uniqueSuffix}`, false);
    const repeatMatch = customerUpiService.matchUpiPayment({ vpa: customVpa });
    assert(repeatMatch.best_match!.confidence_score === 98, `Repeat confirmed VPA (3x) has 98% confidence (got ${repeatMatch.best_match?.confidence_score}%)`);

    // STEP 5: Test Unified Chronological Timeline (Interleaving Invoices, Payments, Credit, and Activity Logs)
    console.log('\n[STEP 5] Testing unified chronological customer timeline...');

    const baseTime = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 5a. Create invoice purchase (-4 days ago)
    const draft = invoiceService.createDraft({ customer_id: testCust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft.id, product_variant_id: 1, quantity_grams: 1000, quantity_units: null });
    const draftDetail = invoiceService.getInvoice(draft.id);
    const itemTotal = draftDetail.items.reduce((sum: number, it: any) => sum + it.line_total_paise, 0);
    invoiceService.recordPayment({ invoice_id: draft.id, amount_paise: itemTotal, method: 'upi' });
    const completedInv = invoiceService.completeInvoice({ invoiceId: draft.id });
    db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?").run(new Date(baseTime - 4 * dayMs).toISOString(), completedInv.invoice.id);

    // 5b. Record credit deposit / payment (-3 days ago)
    const payRes = creditService.recordPayment({
      customer_id: testCust.id,
      amount_paise: 10000,
      method: 'upi',
      reference_number: 'PAYREF-1234',
      notes: 'Settlement advance',
    });
    db.prepare("UPDATE customer_payment_records SET created_at = ? WHERE id = ?").run(new Date(baseTime - 3 * dayMs).toISOString(), payRes.id);

    // 5c. Record ledger credit note (-2 days ago)
    const creditNoteRes = creditService.createCreditNote(testCust.id, null, 5000, 'Quality concession rebate') as any;
    db.prepare("UPDATE customer_ledger SET created_at = ? WHERE id = ?").run(new Date(baseTime - 2 * dayMs).toISOString(), creditNoteRes.id);

    // 5d. Log activity note (-1 day ago)
    db.prepare(`
      INSERT INTO customer_activity_logs (customer_id, action, details, performed_by, created_at)
      VALUES (?, 'profile_update', 'Updated customer cutting preferences to Curry Cut', 1, ?)
    `).run(testCust.id, new Date(baseTime - 1 * dayMs).toISOString());

    // Fetch unified timeline
    const timeline = customerService.getCustomerUnifiedTimeline(testCust.id);

    assert(timeline.length >= 4, `Timeline returned ${timeline.length} events (expected >= 4)`);

    // Verify all 4 event types are present
    const hasPurchase = timeline.some(t => t.type === 'purchase');
    const hasPayment = timeline.some(t => t.type === 'payment');
    const hasCredit = timeline.some(t => t.type === 'credit');
    const hasActivity = timeline.some(t => t.type === 'activity');

    assert(hasPurchase, 'Timeline contains purchase event');
    assert(hasPayment, 'Timeline contains payment event');
    assert(hasCredit, 'Timeline contains credit event');
    assert(hasActivity, 'Timeline contains activity event');

    // Verify strict descending chronological ordering
    let isChronological = true;
    for (let i = 0; i < timeline.length - 1; i++) {
      const t1 = new Date(timeline[i].timestamp).getTime();
      const t2 = new Date(timeline[i + 1].timestamp).getTime();
      if (t1 < t2) {
        isChronological = false;
        break;
      }
    }
    assert(isChronological, 'Timeline events are in strict descending chronological order (newest first)');

    // STEP 6: Test CRM Alerts Summary & Retention Desk
    console.log('\n[STEP 6] Testing CRM Alerts summary & retention desk...');
    const alerts = customerIntelligenceService.getShopCrmAlertsSummary();

    assert(alerts.total_customers > 0, `Shop total customers count: ${alerts.total_customers}`);
    assert(typeof alerts.due_today_count === 'number', `Due today count: ${alerts.due_today_count}`);
    assert(typeof alerts.at_risk_count === 'number', `At risk count: ${alerts.at_risk_count}`);
    assert(typeof alerts.vip_count === 'number', `VIP count: ${alerts.vip_count}`);
    assert(typeof alerts.inactive_count === 'number', `Inactive count: ${alerts.inactive_count}`);
    assert(typeof alerts.shop_avg_visit_interval === 'number', `Shop average visit interval: ${alerts.shop_avg_visit_interval} days`);

    // Test "Customers Needing Attention" sorting
    const overdueList = customerIntelligenceService.getCustomersNeedingAttention({ sortBy: 'days_overdue', limit: 10 });
    assert(Array.isArray(overdueList), 'Customers needing attention returned array');

    const ltvList = customerIntelligenceService.getCustomersNeedingAttention({ sortBy: 'lifetime_value', limit: 10 });
    assert(Array.isArray(ltvList), 'Customers needing attention (by LTV) returned array');

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
