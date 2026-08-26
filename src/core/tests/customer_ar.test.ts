import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { arReportsService } from '../../modules/customers/backend/service/ar_reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

app.whenReady().then(async () => {
  console.log('\n==================================================');
  console.log('       STARTING CUSTOMER A/R BUSINESS MODULE TEST');
  console.log('==================================================\n');

  try {
    // Run migrations first
    migrationEngine.run();

    // 1. Mock user session
    authService.login('admin', 'admin123'); // Ensure logged in as admin/manager for validation tests

    // 2. Clear old test customer if exists
    db.prepare("DELETE FROM customers WHERE name = 'AR Test Customer'").run();

    console.log('[TEST 1] Creating AR Test Customer with limit ₹10,000...');
    const cust = customerService.createCustomer({
      name: 'AR Test Customer',
      phone: '9998887770',
      category: 'Wholesale',
      credit_allowed: true,
      credit_limit_paise: 10000 * 100, // ₹10,000
    }) as any;

    console.log(`[PASS] Customer created. Code: ${cust.customer_code}, ID: ${cust.id}`);

    // Verify credit account default values
    const account = creditService.getCreditAccount(cust.id) as any;
    console.log(`[TEST 2] Verifying Credit Account limits. Hard: ₹${account.hard_limit_paise/100}, Soft: ₹${account.soft_limit_paise/100}`);
    if (account.hard_limit_paise !== 10000*100 || account.soft_limit_paise !== 9000*100) {
      throw new Error('Credit account limits mismatch');
    }
    console.log('[PASS] Credit account limits successfully seeded');

    // 3. Create Draft Invoices
    console.log('[TEST 3] Creating draft invoice and linking customer...');
    const draft = invoiceService.createDraft({ is_gst_invoice: false }) as any;
    invoiceService.linkCustomer(draft.id, cust.id);
    
    // Add item (need variant, find first active)
    const variant = db.prepare('SELECT id, variant_name, current_rate_paise_per_unit FROM product_variants LIMIT 1').get() as { id: number; variant_name: string; current_rate_paise_per_unit: number };
    if (!variant) throw new Error('No product variants in DB. Seed products first.');
    const unitType = (db.prepare('SELECT unit_type FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = ?').get(variant.id) as any).unit_type;

    await invoiceService.addItem({
      invoice_id: draft.id,
      product_variant_id: variant.id,
      quantity_units: unitType === 'piece' ? 5 : null,
      quantity_grams: unitType === 'weight' ? 500 : null
    });

    // 4. Validate Credit Sale Checkout
    console.log('[TEST 4] Completing credit invoice checkout...');
    const completed = invoiceService.completeInvoice(draft.id) as any;
    console.log(`[PASS] Invoice completed. Number: ${completed.invoice.invoice_number}, Status: ${completed.invoice.status}, Total: ₹${completed.invoice.total_paise/100}`);

    // Reload customer profile to verify outstanding balance updated
    let updatedCust = customerService.getCustomerById(cust.id) as any;
    console.log(`[TEST 5] Verifying customer outstanding balance: ₹${updatedCust.outstanding_balance_paise/100}`);
    if (updatedCust.outstanding_balance_paise !== completed.invoice.total_paise) {
      throw new Error('Outstanding balance mismatch');
    }
    console.log('[PASS] Outstanding balance correctly updated');

    // 5. Record Payment & FIFO allocation
    console.log('[TEST 6] Recording partial customer payment of ₹1,000...');
    const invoiceTotal = completed.invoice.total_paise;
    const payRes = creditService.recordPayment({
      customer_id: cust.id,
      amount_paise: 1000 * 100, // ₹1,000
      method: 'cash',
      notes: 'Test partial payment'
    }) as any;
    console.log(`[PASS] Payment recorded. Allocated items: ${payRes.data.applied.length}`);

    // Check outstanding reduce
    updatedCust = customerService.getCustomerById(cust.id) as any;
    console.log(`[TEST 7] Outstanding balance after payment: ₹${updatedCust.outstanding_balance_paise/100}`);
    if (updatedCust.outstanding_balance_paise !== 0) {
      throw new Error('Outstanding balance failed to reduce to 0');
    }
    console.log('[PASS] Partial payment reduced outstanding correctly');

    // 6. Record Advance Deposit
    console.log('[TEST 8] Depositing ₹5,000 advance...');
    creditService.depositAdvance({
      customer_id: cust.id,
      amount_paise: 5000 * 100,
      method: 'upi',
      notes: 'Test advance deposit'
    });

    updatedCust = customerService.getCustomerById(cust.id) as any;
    console.log(`[TEST 9] Advance balance: ₹${updatedCust.advance_balance_paise/100}`);
    const expectedAdvance = (5000 * 100) + (1000 * 100 - invoiceTotal);
    if (updatedCust.advance_balance_paise !== expectedAdvance) {
      throw new Error('Advance deposit failed to update balance');
    }
    console.log('[PASS] Advance deposit recorded correctly');

    // 7. Statement generation
    console.log('[TEST 10] Fetching ledger list & period statement...');
    const stmt = arReportsService.getCustomerStatement(cust.id, '2020-01-01', '2030-12-31') as any;
    console.log(`[PASS] Statement loaded. Number of ledger entries: ${stmt.entries.length}`);

    // Clean up
    db.prepare('DELETE FROM customers WHERE id = ?').run(cust.id);

    console.log('\n==================================================');
    console.log('       A/R DIAGNOSTIC TESTS COMPLETED SUCCESSFUL!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[FATAL] A/R module test failed with error:', err);
    process.exit(1);
  }
});
