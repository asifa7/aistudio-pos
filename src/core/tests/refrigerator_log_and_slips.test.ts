import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { inventoryService } from '../../modules/inventory/backend/service/inventory_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

app.whenReady().then(async () => {
  console.log('\n=============================================================');
  console.log('   STARTING REFRIGERATOR LOGS, SLIPS & CONSTRAINT TEST');
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
    // 1. Run migrations to apply 047
    console.log('[STEP 1] Running migrations...');
    migrationEngine.run();
    assert(true, 'Migrations ran successfully');

    // 2. Authenticate
    authService.login('admin', 'admin123');

    // 3. Find or seed a product variant for testing
    let variant = db.prepare(`
      SELECT pv.id, pv.variant_name, p.id as prod_id, p.name as prod_name, p.unit_type, p.product_code 
      FROM product_variants pv 
      JOIN products p ON pv.product_id = p.id 
      LIMIT 1
    `).get() as any;

    if (!variant) {
      console.log('Seeding test product...');
      const insProd = db.prepare(`
        INSERT INTO products (product_code, name, unit_type, category, is_active)
        VALUES ('TEST-FRG-01', 'Test Chicken Cut', 'weight', 'Chicken', 1)
      `).run();
      const prodId = insProd.lastInsertRowid;
      const insVar = db.prepare(`
        INSERT INTO product_variants (product_id, variant_name, current_rate_paise_per_unit, is_active)
        VALUES (?, 'Standard', 22000, 1)
      `).run(prodId);
      variant = {
        id: insVar.lastInsertRowid,
        variant_name: 'Standard',
        prod_id: prodId,
        prod_name: 'Test Chicken Cut',
        unit_type: 'weight',
        product_code: 'TEST-FRG-01'
      };
    }

    console.log(`[STEP 2] Testing Refrigerator Stock Addition for variant #${variant.id} (${variant.prod_name})...`);
    
    // 4. Test recordFridgeAddition
    const addResult = inventoryService.recordFridgeAddition({
      product_variant_id: variant.id,
      quantity: 15.5, // 15.5 kg
      unit_type: variant.unit_type,
      notes: 'Morning Fresh Stock for Fridge',
      branch_id: 1,
    });

    assert(addResult.success === true, 'recordFridgeAddition succeeded without CHECK constraint failure');
    assert(typeof addResult.ledger_id === 'number' && addResult.ledger_id > 0, `Generated ledger_id #${addResult.ledger_id}`);
    assert(typeof addResult.reference_number === 'string' && addResult.reference_number.startsWith('FRG-IN-'), `Generated reference number ${addResult.reference_number}`);
    assert(addResult.slip != null, 'Returned slip object for printing');
    assert(addResult.slip.action_type === 'IN', 'Slip action_type is IN');
    assert(addResult.slip.quantity === 15.5, 'Slip quantity matches 15.5 kg');
    assert(addResult.slip.reference_number === addResult.reference_number, 'Slip reference matches ledger entry');

    // 5. Verify ledger entry in DB
    const ledgerRowIn = db.prepare('SELECT * FROM inventory_ledger WHERE id = ?').get(addResult.ledger_id) as any;
    assert(ledgerRowIn != null, 'Ledger record found in SQLite');
    assert(ledgerRowIn.action_type === 'fridge_deposit', `Ledger action_type is fridge_deposit (${ledgerRowIn.action_type})`);
    assert(ledgerRowIn.quantity_grams === 15500, `Ledger quantity_grams is 15500 (${ledgerRowIn.quantity_grams})`);
    assert(ledgerRowIn.reference_number === addResult.reference_number, 'Ledger reference_number stored correctly');

    console.log('\n[STEP 3] Testing Refrigerator Take Out (Removal)...');

    // 6. Test recordFridgeRemoval (Take Out)
    const removeResult = inventoryService.recordFridgeRemoval({
      product_variant_id: variant.id,
      quantity: 5.0, // 5.0 kg
      unit_type: variant.unit_type,
      reason: 'Moved to Kitchen Prep for Curry Cut',
      branch_id: 1,
    });

    assert(removeResult.success === true, 'recordFridgeRemoval succeeded without CHECK constraint failure');
    assert(typeof removeResult.ledger_id === 'number' && removeResult.ledger_id > 0, `Generated removal ledger_id #${removeResult.ledger_id}`);
    assert(typeof removeResult.reference_number === 'string' && removeResult.reference_number.startsWith('FRG-OUT-'), `Generated removal ref ${removeResult.reference_number}`);
    assert(removeResult.slip != null, 'Returned removal slip object for printing');
    assert(removeResult.slip.action_type === 'OUT', 'Slip action_type is OUT');
    assert(removeResult.slip.quantity === 5.0, 'Slip quantity matches 5.0 kg');
    assert(removeResult.slip.reason === 'Moved to Kitchen Prep for Curry Cut', 'Slip reason matches');

    // 7. Verify removal ledger entry in DB
    const ledgerRowOut = db.prepare('SELECT * FROM inventory_ledger WHERE id = ?').get(removeResult.ledger_id) as any;
    assert(ledgerRowOut != null, 'Removal ledger record found in SQLite');
    assert(ledgerRowOut.action_type === 'fridge_removal', `Ledger action_type is fridge_removal (${ledgerRowOut.action_type})`);
    assert(ledgerRowOut.quantity_grams === -5000, `Ledger quantity_grams is -5000 (${ledgerRowOut.quantity_grams})`);

    console.log('\n[STEP 4] Testing Daily Fridge Activity Log & Date Filtering...');

    // 8. Test getFridgeActivityLog with today's date
    const today = new Date().toISOString().slice(0, 10);
    const dailyLogs = inventoryService.getFridgeActivityLog({ branchId: 1, date: today });
    assert(Array.isArray(dailyLogs), 'getFridgeActivityLog returns array');
    assert(dailyLogs.length >= 2, `Found ${dailyLogs.length} activity records for today`);
    
    // Verify chronological order when date is passed
    const inEntry = dailyLogs.find((l: any) => l.id === addResult.ledger_id);
    const outEntry = dailyLogs.find((l: any) => l.id === removeResult.ledger_id);
    assert(inEntry != null, 'Daily log contains IN entry');
    assert(outEntry != null, 'Daily log contains OUT entry');
    assert(dailyLogs.indexOf(inEntry) < dailyLogs.indexOf(outEntry), 'Chronological ordering verified (IN came before OUT)');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
});
