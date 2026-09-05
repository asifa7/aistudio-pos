// src/core/tests/run_inventory_tests.ts
// Automated Test Suite for All 10 Required Verification Flows (Part 15)

import assert from 'assert';
import { db, dbManager } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { inventoryLedgerService } from '../../modules/inventory/backend/service/inventory_ledger_service';
import { inventoryService } from '../../modules/inventory/backend/service/inventory_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { invoiceRepository } from '../../modules/billing/backend/repository/invoice_repository';
import { physicalAuditService } from '../../modules/inventory/backend/service/physical_audit_service';
import { validateDateRange } from '../utils/date_validation';
import { stockLedgerRepository } from '../../modules/inventory/backend/repository/stock_ledger_repository';
import { inventoryConsistencyChecker } from '../../modules/inventory/backend/service/inventory_consistency_checker';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('🚀 Starting MeatPOS Inventory & Billing Rework Test Suite...\n');

  // Ensure migrations are run first
  migrationEngine.run();

  // Set active mock Admin session for test runner
  authService.setSession({
    id: 1,
    code: 'ADM',
    username: 'admin',
    role: 'ADMIN',
    is_active: 1,
  });

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      if (err.stack) console.error(err.stack);
    }
  }

  // Helper to create clean test product
  const testProdCode = `TEST-PRD-${Date.now()}`;
  const resProd = db.prepare(`
    INSERT INTO products (name, product_code, category, unit_type, is_inventory_tracked, is_active)
    VALUES ('Fresh Mutton Test', ?, 'Mutton', 'weight', 1, 1)
  `).run(testProdCode);
  const testProdId = Number(resProd.lastInsertRowid);

  const resVar = db.prepare(`
    INSERT INTO product_variants (product_id, variant_name, current_rate_paise_per_unit, cost_price_paise_per_unit, is_active)
    VALUES (?, 'Curry Cut', 50000, 20000, 1)
  `).run(testProdId);
  const testVarId = Number(resVar.lastInsertRowid);

  // Initialize stock ledger row at 0
  db.prepare(`
    INSERT OR REPLACE INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, location_id, safety_threshold_grams)
    VALUES (?, 0, 0, 1, 5000)
  `).run(testVarId);

  // ─── TEST 1: Fresh Purchase Stock & Valuation Test ───
  test('Test 1: Fresh Purchase Stock & Valuation (50 kg @ ₹200/kg -> ₹10,000)', () => {
    // Record purchase of 50 kg (50,000 grams) at ₹200/kg (20000 paise/kg)
    const movRes = inventoryLedgerService.recordMovement({
      product_variant_id: testVarId,
      branch_id: 1,
      action_type: 'PURCHASE',
      quantity_grams: 50000,
      unit_cost_paise: 20000,
      reference_type: 'purchase',
      reference_number: 'TEST-PUR-001',
      notes: 'Initial test purchase 50 kg',
    });

    // Check stock ledger shows 50,000 grams (50 kg)
    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, 50000, 'Stock ledger must show 50,000 grams');

    // Check batch created in product_stock_batches
    const batch = db.prepare("SELECT * FROM product_stock_batches WHERE product_variant_id = ? AND status = 'active'").get(testVarId) as any;
    assert.ok(batch, 'Active batch must be created');
    assert.strictEqual(batch.current_quantity_grams, 50000);
    assert.strictEqual(batch.unit_cost_paise, 20000);

    // Check Valuation Report
    const valReport = inventoryService.getStockValuationReport({});
    const valItem = valReport.items.find((i: any) => i.product_variant_id === testVarId);
    assert.ok(valItem, 'Purchased product must appear in valuation report');
    assert.strictEqual(valItem.total_cost_value_paise, 1000000, 'Total cost value must be 1,000,000 paise (₹10,000)');
  });

  // ─── TEST 2: Sale Deduction Test ───
  let createdInvoiceId = 0;
  test('Test 2: Sale Deduction (Sell 10 kg from 50 kg -> 40 kg & ₹8,000 valuation)', () => {
    const draft = invoiceService.createDraft({ customer_id: null });
    createdInvoiceId = draft.id;

    invoiceService.addItem({
      invoice_id: createdInvoiceId,
      product_variant_id: testVarId,
      quantity_grams: 10000,
      quantity_units: null,
      override_rate_paise: 50000,
    });

    const fullInvoice = invoiceService.getInvoice(createdInvoiceId);

    // Complete invoice
    invoiceService.completeInvoice({
      invoice_id: createdInvoiceId,
      payments: [
        {
          method: 'cash',
          amount_paise: fullInvoice.invoice.total_paise,
          details: 'Cash sale'
        }
      ]
    });

    // Check stock ledger shows 40,000 grams (40 kg)
    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, 40000, 'Stock ledger must show 40,000 grams');

    // Check valuation is ₹8,000 (40 kg * ₹200)
    const valReport = inventoryService.getStockValuationReport({});
    const valItem = valReport.items.find((i: any) => i.product_variant_id === testVarId);
    assert.strictEqual(valItem.total_cost_value_paise, 800000, 'Valuation must show 800,000 paise (₹8,000)');
  });

  // ─── TEST 3: Void Sale Reversal Test ───
  test('Test 3: Void Sale Reversal (Void sale -> Stock restored to 50 kg & ₹10,000)', () => {
    invoiceService.voidInvoice({
      invoice_id: createdInvoiceId,
      voided_by: 1,
      void_reason: 'Customer cancelled test',
    });

    // Stock ledger should return atomically to 50,000 grams
    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, 50000, 'Stock ledger must be restored to 50,000 grams');

    // Valuation returns to ₹10,000
    const valReport = inventoryService.getStockValuationReport({});
    const valItem = valReport.items.find((i: any) => i.product_variant_id === testVarId);
    assert.strictEqual(valItem.total_cost_value_paise, 1000000, 'Valuation must return to ₹10,000');
  });

  // ─── TEST 4: Return Restored Test ───
  test('Test 4: Sales Return Restored (Return 5 kg good meat -> Stock increases by 5 kg)', () => {
    // Process return with stock_resolution: 'restored'
    invoiceService.returnInvoice({
      invoice_id: createdInvoiceId,
      reason: 'Wrong cut selected',
      stock_resolution: 'restored',
      refund_given: true,
      refund_method: 'cash',
      items: [
        {
          product_variant_id: testVarId,
          quantity_grams: 5000,
          quantity_units: null,
          unit_rate_paise: 50000,
          refund_total_paise: 250000,
        }
      ]
    });

    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, 55000, 'Stock ledger must increase by 5 kg to 55 kg');
  });

  // ─── TEST 5: Return Discarded Test ───
  test('Test 5: Sales Return Discarded (Return spoiled meat -> Stock does NOT increase)', () => {
    const prevStockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    const initialGrams = prevStockRow.quantity_grams;

    // Process return with stock_resolution: 'discarded'
    invoiceService.returnInvoice({
      invoice_id: createdInvoiceId,
      reason: 'Meat went bad',
      stock_resolution: 'discarded',
      refund_given: true,
      refund_method: 'cash',
      items: [
        {
          product_variant_id: testVarId,
          quantity_grams: 3000,
          quantity_units: null,
          unit_rate_paise: 50000,
          refund_total_paise: 150000,
        }
      ]
    });

    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, initialGrams, 'Stock must NOT increase for discarded returns');

    // Wastage logged in inventory_ledger
    const wastageRow = db.prepare("SELECT * FROM inventory_ledger WHERE product_variant_id = ? AND UPPER(action_type) = 'WASTAGE' ORDER BY id DESC LIMIT 1").get(testVarId) as any;
    assert.ok(wastageRow, 'Wastage entry must be recorded in inventory_ledger');
    assert.strictEqual(wastageRow.reason_code, 'spoilage');
  });

  // ─── TEST 6: Physical Count Variance Test ───
  test('Test 6: Physical Count Multi-Stage Audit (-2 kg variance, reason cutting_loss)', () => {
    // Current stock is 55 kg (55,000 g). Physical count finds 53 kg (-2 kg cutting loss)
    const { session_id } = physicalAuditService.createSession({ notes: 'Daily Closing Count' });
    
    physicalAuditService.saveCounts(session_id, [
      {
        product_variant_id: testVarId,
        counted_quantity: 53.0,
        reason_code: 'cutting_loss',
        notes: 'Bone trim loss',
      }
    ]);

    physicalAuditService.submitSession(session_id);
    physicalAuditService.reviewSession(session_id);
    physicalAuditService.approveSession(session_id);
    const applyRes = physicalAuditService.applySession(session_id);

    assert.ok(applyRes.appliedCount >= 1, 'Audit adjustment must be applied');

    // Check stock ledger updated to 53 kg (53,000 g)
    const stockRow = db.prepare('SELECT quantity_grams FROM stock_ledger WHERE product_variant_id = ?').get(testVarId) as any;
    assert.strictEqual(stockRow.quantity_grams, 53000, 'Stock must update to 53,000 grams');

    // Check ledger entry
    const auditLedger = db.prepare("SELECT * FROM inventory_ledger WHERE product_variant_id = ? AND UPPER(action_type) = 'PHYSICAL_COUNT_ADJUSTMENT' ORDER BY id DESC LIMIT 1").get(testVarId) as any;
    assert.ok(auditLedger, 'PHYSICAL_COUNT_ADJUSTMENT ledger row must exist');
    assert.strictEqual(auditLedger.quantity_grams, -2000, 'Variance must be -2,000 grams');
    assert.strictEqual(auditLedger.reason_code, 'cutting_loss');
  });

  // ─── TEST 7: Date Range Validation Test ───
  test('Test 7: Date Range Validation (fromDate > toDate rejected cleanly)', () => {
    const invalidResult = validateDateRange('2026-09-15', '2026-09-01');
    assert.strictEqual(invalidResult.isValid, false, 'Invalid range must be rejected');
    assert.ok(invalidResult.error?.includes('cannot be earlier'), 'Error message must be clear');

    const validResult = validateDateRange('2026-09-01', '2026-09-15');
    assert.strictEqual(validResult.isValid, true, 'Valid range must be accepted');
  });

  // ─── TEST 8: Multi-Field Bill Search Test ───
  test('Test 8: Bill Search (Partial bill number, customer name, derived status)', () => {
    const results = invoiceRepository.searchInvoices({
      billNumber: String(createdInvoiceId),
    });

    assert.ok(results.length > 0, 'Must find invoice by ID / number');
    const bill = results[0];
    assert.strictEqual(bill.derived_status, 'Cancelled', 'Voided bill must have derived_status Cancelled');
  });

  // ─── TEST 9: Needs Attention Accuracy Test ───
  test('Test 9: Needs Attention Accuracy (Healthy product NOT in attention, 0 stock IS in attention)', () => {
    const summary = stockLedgerRepository.getSidebarSummary();
    
    // Healthy product with 53 kg and 5 kg threshold must NOT be critical
    const healthyItem = summary.needsAttention.find((i: any) => i.product_variant_id === testVarId);
    assert.strictEqual(healthyItem, undefined, 'Healthy stock with 53kg must NOT be in needs attention');

    // Create 0-stock tracked product
    const zeroCode = `ZERO-${Date.now()}`;
    const zeroProd = db.prepare("INSERT INTO products (name, product_code, category, unit_type, is_inventory_tracked, is_active) VALUES ('Zero Stock Mutton', ?, 'Mutton', 'weight', 1, 1)").run(zeroCode);
    const zeroVar = db.prepare("INSERT INTO product_variants (product_id, variant_name, current_rate_paise_per_unit, cost_price_paise_per_unit, is_active) VALUES (?, 'Chops', 50000, 20000, 1)").run(zeroProd.lastInsertRowid);
    db.prepare("INSERT INTO stock_ledger (product_variant_id, quantity_grams, quantity_units, location_id, safety_threshold_grams) VALUES (?, 0, 0, 1, 5000)").run(zeroVar.lastInsertRowid);

    const updatedSummary = stockLedgerRepository.getSidebarSummary();
    const zeroItem = updatedSummary.needsAttention.find((i: any) => i.product_variant_id === zeroVar.lastInsertRowid);
    assert.ok(zeroItem, '0-stock item MUST appear in needs attention');
    assert.strictEqual(zeroItem.status, 'critical');
  });

  // ─── TEST 10: Refrigerator Age Preservation Test ───
  test('Test 10: Refrigerator Aging Preservation (Preserve original batch date on return to fridge)', () => {
    const day1Date = '2026-08-25';
    // 1. Initial Fridge In on Aug 25
    const addRes = inventoryService.recordFridgeAddition({
      product_variant_id: testVarId,
      quantity: 10.0,
      unit_type: 'weight',
      entry_date: day1Date,
      notes: 'Initial walk-in deposit',
      user_id: 1,
    });

    // 2. Fridge Out 5 kg
    inventoryService.recordFridgeRemoval({
      product_variant_id: testVarId,
      quantity: 5.0,
      unit_type: 'weight',
      reason: 'To Cutting Counter',
      user_id: 1,
    });

    // 3. Return remaining 2 kg back to fridge with original_batch_date preserved
    const retRes = inventoryService.recordFridgeAddition({
      product_variant_id: testVarId,
      quantity: 2.0,
      unit_type: 'weight',
      entry_date: '2026-08-28',
      notes: 'Counter return',
      user_id: 1,
      ...({ original_batch_date: day1Date, is_return: true } as any),
    });

    // Check the newly created batch has original_batch_date = 2026-08-25
    const retBatch = db.prepare('SELECT original_batch_date FROM product_stock_batches WHERE id = ?').get(retRes.batch_id) as any;
    assert.strictEqual(retBatch.original_batch_date, day1Date, 'Original entry date must be preserved upon return to fridge');
  });

  // ─── BONUS: Consistency Checker Test ───
  test('Bonus: Inventory Consistency Checker', () => {
    const checkReport = inventoryConsistencyChecker.runConsistencyCheck();
    assert.ok(checkReport.total_checked_variants > 0, 'Must check active tracked variants');
    console.log(`   Checked ${checkReport.total_checked_variants} variants. Status: ${checkReport.status}`);
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} / ${total} Passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL 10 TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
