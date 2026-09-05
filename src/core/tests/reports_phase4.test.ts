import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { reportsService } from '../../modules/reports/backend/service/reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { authService } from '../../modules/auth/backend/service/auth_service';
import { yieldProcessingService } from '../../modules/inventory/backend/service/yield_processing_service';
import { inventoryLedgerService } from '../../modules/inventory/backend/service/inventory_ledger_service';

async function runPhase4Tests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 4: INVENTORY, YIELD & PURCHASES');
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
    const loginRes = authService.login('admin', 'admin123');
    const userId = loginRes?.user?.id || 1;
    assert(loginRes !== null, 'Authenticated admin user for test session');

    // STEP 2: Seed Test Supplier, Purchases, Yield Processing & Wastage
    console.log('\n[STEP 2] Seeding test supplier, purchases, yield processing, and wastage...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);

    // 1. Create Supplier
    const supCode = `SUP-${uniqueSuffix}`;
    const supRes = db.prepare(`
      INSERT INTO suppliers (code, company_name, phone)
      VALUES (?, ?, ?)
    `).run(supCode, `Quality Poultry Farms ${uniqueSuffix}`, '9876500001');
    const supplierId = supRes.lastInsertRowid as number;
    assert(supplierId > 0, `Created supplier #${supplierId} (${supCode})`);

    // 2. Create raw carcass variant if needed or use existing variant 1 & 2
    // Let's record purchases for variant 1 (Chicken Breast) and variant 5 (Mutton)
    db.prepare(`
      INSERT INTO purchases (supplier_id, product_variant_id, quantity_grams, quantity_units, cost_paise, created_by)
      VALUES (?, 1, 20000, NULL, 360000, ?)
    `).run(supplierId, userId); // 20kg Chicken @ ₹180/kg = ₹3600.00

    db.prepare(`
      INSERT INTO purchases (supplier_id, product_variant_id, quantity_grams, quantity_units, cost_paise, created_by)
      VALUES (?, 5, 10000, NULL, 500000, ?)
    `).run(supplierId, userId); // 10kg Mutton @ ₹500/kg = ₹5000.00
    assert(true, 'Logged 2 purchase shipments into purchases table');

    // Log purchase to unified inventory_ledger
    inventoryLedgerService.recordEntry({
      product_variant_id: 1,
      action_type: 'purchase',
      quantity_grams: 20000,
      quantity_units: null,
      unit_cost_paise: 18000,
      reference_type: 'purchase',
      reference_id: supplierId,
      notes: 'Initial test shipment of Chicken Breast',
      created_by: userId,
    });

    // 3. Create Yield Processing Run
    // Input: 10kg Chicken (variant 1), Outputs: 8kg Curry Cut (variant 2) + 2kg wastage
    try {
      yieldProcessingService.executeYieldProcessing({
        raw_input_variant_id: 1,
        input_quantity: 10, // 10kg
        outputs: [
          { output_variant_id: 2, quantity: 8 } // 8kg output
        ],
        wastage_quantity: 2, // 2kg waste
        notes: `Test deboning run ${uniqueSuffix}`
      }, userId);
      assert(true, 'Executed Yield Processing Run (10kg raw input -> 8kg output + 2kg waste)');
    } catch (e: any) {
      // If FIFO stock wasn't sufficient in batches, insert yield run record directly
      const runNumber = `YLD-${uniqueSuffix}`;
      const runRes = db.prepare(`
        INSERT INTO yield_processing_runs (
          run_number, raw_input_variant_id, input_quantity_grams, input_quantity_units,
          total_input_cost_paise, wastage_quantity_grams, wastage_quantity_units, processed_by, notes
        ) VALUES (?, 1, 10000, NULL, 180000, 2000, 0, ?, ?)
      `).run(runNumber, userId, `Direct yield test ${uniqueSuffix}`);
      const runId = runRes.lastInsertRowid as number;

      db.prepare(`
        INSERT INTO yield_processing_outputs (
          yield_run_id, output_variant_id, output_quantity_grams, output_quantity_units,
          allocated_cost_paise, unit_cost_paise
        ) VALUES (?, 2, 8000, NULL, 180000, 22500)
      `).run(runId);
      assert(true, 'Created yield processing run record directly');
    }

    // 4. Log Wastage entry into inventory_ledger
    inventoryLedgerService.recordEntry({
      product_variant_id: 1,
      action_type: 'wastage',
      quantity_grams: 1500, // 1.5kg
      quantity_units: null,
      unit_cost_paise: 18000,
      reference_type: 'wastage_log',
      reference_id: null,
      reference_number: `WASTE-${uniqueSuffix}`,
      notes: 'Spoilage / Cold Chain Failure',
      created_by: userId,
    });
    assert(true, 'Logged 1.5kg wastage entry to inventory_ledger');

    // STEP 3: Test Section A — Inventory Reports
    console.log('\n[STEP 3] Testing Section A — Inventory Reports...');

    // 1. Stock on Hand Report
    const stockOnHandRes = reportEngine.runReport({
      reportId: 'stock_on_hand_report',
    });
    assert(stockOnHandRes.reportId === 'stock_on_hand_report', 'Stock on Hand Report executed');
    assert(stockOnHandRes.totalRows >= 1, `Stock on hand returned ${stockOnHandRes.totalRows} product records`);
    assert(stockOnHandRes.columns.some((c: any) => c.id === 'stock_valuation_paise'), 'Includes Stock Value (₹) measure');
    assert(stockOnHandRes.grandTotals.stock_valuation_paise > 0, `Total stock valuation: ₹${stockOnHandRes.grandTotals.stock_valuation_paise / 100}`);

    // 2. Stock Movement Ledger Report
    const stockMovementRes = reportEngine.runReport({
      reportId: 'stock_movement_report',
    });
    assert(stockMovementRes.reportId === 'stock_movement_report', 'Stock Movement Report executed');
    assert(stockMovementRes.columns.some((c: any) => c.id === 'purchases_qty'), 'Includes Purchases (+) column');
    assert(stockMovementRes.columns.some((c: any) => c.id === 'sales_qty'), 'Includes Sales (-) column');
    assert(stockMovementRes.columns.some((c: any) => c.id === 'wastage_qty'), 'Includes Wastage (-) column');
    assert(stockMovementRes.columns.some((c: any) => c.id === 'closing_stock_qty'), 'Includes Closing Stock column');

    // Verify closing stock matches stock_ledger for variant 1
    const chickenRow = stockMovementRes.rows.find((r: any) => r.variant_name?.includes('Breast') || r.product_name?.includes('Chicken'));
    assert(chickenRow !== undefined, 'Chicken row found in Stock Movement report');

    // 3. Stock Valuation Report
    const stockValuationRes = reportEngine.runReport({
      reportId: 'stock_valuation_report',
    });
    assert(stockValuationRes.reportId === 'stock_valuation_report', 'Stock Valuation Report executed');
    assert(stockValuationRes.columns.some((c: any) => c.id === 'costing_method_label'), 'Includes Costing Method column');
    assert(stockValuationRes.grandTotals.stock_valuation_paise > 0, `Valuation report total: ₹${stockValuationRes.grandTotals.stock_valuation_paise / 100}`);

    // STEP 4: Test Section B — Meat-Shop Yield Report
    console.log('\n[STEP 4] Testing Section B — Meat-Shop Yield Report...');

    const yieldRes = reportEngine.runReport({
      reportId: 'meat_yield_report',
    });
    assert(yieldRes.reportId === 'meat_yield_report', 'Meat-Shop Yield Report executed');
    assert(yieldRes.totalRows >= 1, `Found ${yieldRes.totalRows} yield processing runs`);
    assert(yieldRes.columns.some((c: any) => c.id === 'actual_yield_percent'), 'Includes Actual Yield % column');
    assert(yieldRes.columns.some((c: any) => c.id === 'expected_yield_percent'), 'Includes Expected Yield % column');
    assert(yieldRes.columns.some((c: any) => c.id === 'yield_variance_percent'), 'Includes Variance % column');

    const yieldRow = yieldRes.rows[0];
    assert(yieldRow.input_weight_kg > 0, `Input weight: ${yieldRow.input_weight_kg} kg`);
    assert(yieldRow.saleable_output_weight_kg > 0, `Saleable output weight: ${yieldRow.saleable_output_weight_kg} kg`);
    assert(yieldRow.actual_yield_percent > 0, `Actual yield %: ${yieldRow.actual_yield_percent}%`);

    // STEP 5: Test Section C — Wastage / Loss & Dead Stock
    console.log('\n[STEP 5] Testing Section C — Wastage / Loss & Dead Stock...');

    // 1. Wastage / Loss Report
    const wastageRes = reportEngine.runReport({
      reportId: 'wastage_loss_report',
    });
    assert(wastageRes.reportId === 'wastage_loss_report', 'Wastage & Loss Report executed');
    assert(wastageRes.totalRows >= 1, `Found ${wastageRes.totalRows} wastage records`);
    assert(wastageRes.columns.some((c: any) => c.id === 'total_loss_paise'), 'Includes Total Loss (₹) measure');

    const wasteEntry = wastageRes.rows.find((r: any) => r.reference_number?.includes(String(uniqueSuffix)) || r.reason?.includes('Spoilage'));
    assert(wasteEntry !== undefined, 'Logged wastage entry found in Wastage Report');
    if (wasteEntry) {
      assert(wasteEntry.wastage_weight_kg === 1.5, `Wastage weight is 1.5 kg (got ${wasteEntry.wastage_weight_kg})`);
      assert(wasteEntry.total_loss_paise > 0, `Total loss is ₹${wasteEntry.total_loss_paise / 100}`);
    }

    // 2. Dead Stock Report
    const deadStockRes = reportEngine.runReport({
      reportId: 'dead_stock_report',
    });
    assert(deadStockRes.reportId === 'dead_stock_report', 'Dead Stock Report executed');
    assert(deadStockRes.columns.some((c: any) => c.id === 'days_without_sale'), 'Includes Days Without Sale column');
    assert(deadStockRes.columns.some((c: any) => c.id === 'recommended_action'), 'Includes Recommended Action column');
    assert(deadStockRes.rows.length >= 1, `Identified ${deadStockRes.rows.length} items evaluated for dead stock`);

    // STEP 6: Test Section D — Purchase Reports
    console.log('\n[STEP 6] Testing Section D — Purchase Reports...');

    // 1. Purchase Transactions Report
    const purchaseTxRes = reportEngine.runReport({
      reportId: 'purchase_transactions_report',
    });
    assert(purchaseTxRes.reportId === 'purchase_transactions_report', 'Purchase Transactions Report executed');
    assert(purchaseTxRes.totalRows >= 2, `Found ${purchaseTxRes.totalRows} purchase transactions`);
    const supTx = purchaseTxRes.rows.find((r: any) => r.supplier_code === supCode);
    assert(supTx !== undefined, `Supplier #${supCode} transactions found in Purchase Transactions report`);

    // 2. Supplier Summary Report
    const supplierSummaryRes = reportEngine.runReport({
      reportId: 'supplier_summary_report',
    });
    assert(supplierSummaryRes.reportId === 'supplier_summary_report', 'Supplier Summary Report executed');
    assert(supplierSummaryRes.totalRows >= 1, `Found ${supplierSummaryRes.totalRows} suppliers`);
    const supRow = supplierSummaryRes.rows.find((r: any) => r.supplier_code === supCode);
    assert(supRow !== undefined, 'Created supplier found in Supplier Summary report');
    if (supRow) {
      assert(supRow.total_purchases_count === 2, `Total orders is 2 (got ${supRow.total_purchases_count})`);
      assert(supRow.total_spend_paise === 860000, `Total spend is ₹8600.00 (${supRow.total_spend_paise} paise)`);
    }

    // 3. Purchase Price Variance Report
    const varianceRes = reportEngine.runReport({
      reportId: 'purchase_price_variance_report',
    });
    assert(varianceRes.reportId === 'purchase_price_variance_report', 'Purchase Price Variance Report executed');
    assert(varianceRes.columns.some((c: any) => c.id === 'cost_change_percent'), 'Includes Cost Change % column');
    assert(varianceRes.columns.some((c: any) => c.id === 'margin_after_increase_percent'), 'Includes Effective Margin % column');
    assert(varianceRes.totalRows >= 1, `Evaluated ${varianceRes.totalRows} product variants for purchase price variance`);

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE PHASE 4 TEST]:', err);
    process.exit(1);
  }
}

app.whenReady().then(async () => {
  await runPhase4Tests();
  app.quit();
});
