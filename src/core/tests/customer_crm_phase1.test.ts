import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('\n=============================================================');
  console.log('   STARTING CUSTOMER CRM PHASE 1 AUTOMATED TESTS');
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
    console.log('[STEP 1] Running migrations including 048_customer_crm_phase1.sql...');
    migrationEngine.run();
    assert(true, 'Migrations completed successfully');

    // Authenticate test user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Logged in as test admin user');

    // Generate dynamic test phone numbers
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhoneA = `9844${uniqueSuffix}`;
    const testPhoneB = `9877${uniqueSuffix}`;

    // STEP 2: Duplicate Customer Detection & Structured Preferences
    console.log('\n[STEP 2] Testing duplicate customer detection & structured preferences...');
    
    // Create customer A with phone testPhoneA
    const custA = customerService.createCustomer({
      name: `Duplicate Test Alpha ${uniqueSuffix}`,
      phone: testPhoneA,
      whatsapp: testPhoneA,
      category: 'Retail',
      preferred_cut: 'Boneless',
      skin_preference: 'No Skin',
      cutting_preference: 'Curry Cut',
      typical_quantity: '1.5 kg',
      delivery_preference: 'Counter Pickup',
      packaging_preference: 'Standard',
      special_instructions: 'Pack separately from mutton',
    });

    assert(custA.id > 0, `Created Customer Alpha with ID #${custA.id} (${custA.customer_code})`);
    assert(custA.preferred_cut === 'Boneless', 'Customer Alpha has preferred_cut: Boneless');
    assert(custA.skin_preference === 'No Skin', 'Customer Alpha has skin_preference: No Skin');
    assert(custA.cutting_preference === 'Curry Cut', 'Customer Alpha has cutting_preference: Curry Cut');
    assert(custA.special_instructions === 'Pack separately from mutton', 'Customer Alpha special instructions verified');

    // Test Duplicate check with same phone
    const dupCheck1 = customerService.checkDuplicateCustomers({
      phone: testPhoneA,
      name: 'New Different Name',
    });
    assert(dupCheck1.hasDuplicate === true, `Duplicate check found match for exact phone ${testPhoneA}`);
    assert(dupCheck1.duplicates.length > 0 && dupCheck1.duplicates[0].id === custA.id, 'Duplicate match points to Customer Alpha');

    // Test Duplicate check with excluded ID (edit mode)
    const dupCheck2 = customerService.checkDuplicateCustomers({
      phone: testPhoneA,
      excludeId: custA.id,
    });
    assert(dupCheck2.hasDuplicate === false, 'Duplicate check correctly excludes current customer ID on edit');

    // STEP 3: Fuzzy Customer Search
    console.log('\n[STEP 3] Testing fast fuzzy customer search...');
    // Search by partial phone
    const searchPhone = customerService.searchCustomers(String(uniqueSuffix));
    assert(searchPhone.some(c => c.id === custA.id), `Fuzzy search by partial digits "${uniqueSuffix}" found Customer Alpha`);

    // Search by name fragment
    const searchName = customerService.searchCustomers(`Alpha ${uniqueSuffix}`);
    assert(searchName.some(c => c.id === custA.id), `Fuzzy search by name "Alpha ${uniqueSuffix}" found Customer Alpha`);

    // Search by customer code
    const searchCode = customerService.searchCustomers(custA.customer_code);
    assert(searchCode.some(c => c.id === custA.id), `Fuzzy search by code ${custA.customer_code} found Customer Alpha`);

    // STEP 4: Invoices & Purchase History
    console.log('\n[STEP 4] Testing customer invoice linking & purchase history...');
    
    // Create draft invoice linked to custA
    const draft1 = invoiceService.createDraft({
      customer_id: custA.id,
      is_gst_invoice: false,
    });
    assert(draft1.customer_id === custA.id, 'Draft invoice linked to Customer Alpha');

    // Add item to draft invoice
    invoiceService.addItem({
      invoice_id: draft1.id,
      product_variant_id: 1,
      quantity_grams: 1500,
      quantity_units: null,
    });

    // Fetch invoice details and pay exact amount
    const draftDetail = invoiceService.getInvoice(draft1.id);
    const itemTotal = draftDetail.items.reduce((sum: number, it: any) => sum + it.line_total_paise, 0);

    // Record payment & complete invoice
    invoiceService.recordPayment({
      invoice_id: draft1.id,
      amount_paise: itemTotal,
      method: 'cash',
    });

    const completed1 = invoiceService.completeInvoice({
      invoiceId: draft1.id,
    });
    assert(completed1.invoice.status === 'completed', 'Completed invoice successfully');
    assert(completed1.invoice.customer_id === custA.id, 'Completed invoice retains customer_id link');

    // Retrieve Purchase History
    const history = customerService.getCustomerPurchaseHistory(custA.id);
    assert(history.total_count >= 1, `Purchase history returned ${history.total_count} invoices`);
    const historyInv = history.invoices.find(i => i.id === completed1.invoice.id);
    assert(historyInv != null, 'Invoice found in customer purchase history');
    assert(historyInv != null && historyInv.items_summary != null && historyInv.items_summary.length > 0, `Purchase history items summary: ${historyInv?.items_summary}`);

    // Overview Summary
    const overview = customerService.getCustomerOverviewSummary(custA.id);
    assert(overview.total_visits >= 1, `Overview total_visits: ${overview.total_visits}`);
    assert(overview.total_purchases_paise > 0, `Overview total_purchases_paise: ₹${overview.total_purchases_paise / 100}`);
    assert(overview.last_purchase_date != null, 'Overview has valid last_purchase_date');

    // STEP 5: Customer Merge
    console.log('\n[STEP 5] Testing Customer Merge...');
    // Create Customer B (Target / Surviving)
    const custB = customerService.createCustomer({
      name: `Surviving Target Customer ${uniqueSuffix}`,
      phone: testPhoneB,
      category: 'Wholesale',
      credit_allowed: true,
      credit_limit_paise: 500000,
      opening_balance_paise: 100000,
    });
    assert(custB.id > 0, `Created Customer Beta #${custB.id} (${custB.customer_code})`);

    // Perform Merge: Merge Alpha (custA) into Beta (custB)
    const mergeResult = customerService.mergeCustomers(custA.id, custB.id, {
      reason: 'Automated test duplicate merge',
    });

    assert(mergeResult.success === true, 'Customer merge completed successfully');
    assert(mergeResult.invoicesTransferred >= 1, `Transferred ${mergeResult.invoicesTransferred} invoices from Alpha to Beta`);

    // Verify source customer status
    const alphaAfter = customerService.getCustomerById(custA.id);
    assert(alphaAfter.status === 'merged', 'Source customer Alpha marked as status: merged');
    assert(alphaAfter.is_active === 0, 'Source customer Alpha marked as inactive');
    assert(alphaAfter.merged_into_customer_id === custB.id, 'Source customer Alpha merged_into_customer_id points to Beta');

    // Verify Beta has the invoice in purchase history
    const betaHistory = customerService.getCustomerPurchaseHistory(custB.id);
    assert(betaHistory.invoices.some(i => i.id === completed1.invoice.id), 'Surviving customer Beta now owns the transferred invoice');

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
