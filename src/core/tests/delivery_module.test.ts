// delivery_module.test.ts
// Comprehensive domain & service test suite for MeatPOS Delivery Module

import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { deliveryService } from '../../modules/delivery/backend/service/delivery_service';
import { addressService } from '../../modules/delivery/backend/service/address_service';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';

async function runDeliveryTests() {
  console.log('\n=============================================================');
  console.log('   STARTING MEATPOS DELIVERY MODULE TEST SUITE');
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
    console.log('[STEP 1] Running database migrations including Migration 056...');
    migrationEngine.run();
    assert(true, 'Database migrations executed cleanly');

    // Clean up test records
    db.prepare('DELETE FROM delivery_status_history').run();
    db.prepare('DELETE FROM delivery_attempts').run();
    db.prepare('DELETE FROM delivery_cod_reconciliation').run();
    db.prepare('DELETE FROM deliveries').run();
    db.prepare("DELETE FROM invoices WHERE invoice_number LIKE 'INV-TEST-DEL-%'").run();
    db.prepare('DELETE FROM customer_addresses WHERE area LIKE ?').run('%Indiranagar%');
    db.prepare('DELETE FROM delivery_drivers WHERE name LIKE ?').run('%Arjun%');
    db.prepare('DELETE FROM delivery_zones WHERE code LIKE ?').run('%ZONE_TEST%');

    // Create fixture customer
    let customerId: number;
    const existingCust = db.prepare('SELECT id FROM customers WHERE phone = ?').get('9999988888') as any;
    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const res = db.prepare(`
        INSERT INTO customers (customer_code, name, phone, category, credit_allowed, outstanding_balance_paise, advance_balance_paise, created_at, updated_at)
        VALUES ('CUST-DEL-TEST-01', 'Test Delivery Customer', '9999988888', 'Retail', 1, 0, 0, datetime('now'), datetime('now'))
      `).run();
      customerId = Number(res.lastInsertRowid);
    }
    assert(Boolean(customerId), `Fixture customer created with ID: ${customerId}`);

    // Create fixture invoice
    const invNumber = `INV-TEST-DEL-${Date.now()}`;
    const invRes = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, status, payment_status, subtotal_paise, cgst_paise, sgst_paise, tax_paise, total_paise, created_by, completed_at, created_at)
      VALUES (?, ?, 'completed', 'paid', 50000, 1250, 1250, 2500, 52500, 1, datetime('now'), datetime('now'))
    `).run(invNumber, customerId);
    const invoiceId = Number(invRes.lastInsertRowid);
    assert(Boolean(invoiceId), `Fixture invoice created with ID: ${invoiceId}`);

    // Create fixture zone
    const zone = deliveryService.createZone({
      name: 'Indiranagar Core Zone',
      code: 'ZONE_TEST_01',
      delivery_charge_paise: 3500,
      min_order_paise: 20000,
      free_delivery_above_paise: 100000,
      estimated_minutes: 40,
      is_default: 1,
    });
    const zoneId = zone.id;
    assert(zone.id > 0 && zone.name === 'Indiranagar Core Zone', `Delivery zone created with ID: ${zoneId}`);

    // Create fixture driver
    const driver = deliveryService.createDriver({
      name: 'Rider Arjun',
      phone: '9876543210',
      vehicle_type: 'two_wheeler',
      vehicle_number: 'KA-01-AB-1234',
      max_concurrent_orders: 4,
      status: 'available',
    });
    const driverId = driver.id;
    assert(driver.id > 0 && driver.name === 'Rider Arjun', `Delivery driver created with ID: ${driverId}`);

    // STEP 2: Address Service
    console.log('\n[STEP 2] Testing Customer Address Pin-Drop & Default Flag...');
    const addr = addressService.createAddress({
      customer_id: customerId,
      label: 'Home',
      door_no: '#42/A',
      building: 'Green Meadows',
      street: '12th Main Road',
      area: 'Indiranagar',
      landmark: 'Near Water Tank',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      is_default: 1,
    });
    assert(addr.id > 0 && addr.area === 'Indiranagar', 'Structured address created with lat/lng');

    const customerAddrs = addressService.getAddressesByCustomer(customerId);
    assert(customerAddrs.length >= 1, `Retrieved ${customerAddrs.length} customer addresses`);

    // STEP 3: Delivery Order Generation (Flow A & Flow B)
    console.log('\n[STEP 3] Testing Delivery Order Generation & State Transitions...');
    const delivery = deliveryService.createDeliveryOrder({
      invoice_id: invoiceId,
      invoice_number: invNumber,
      customer_id: customerId,
      customer_address_id: addr.id,
      zone_id: zoneId,
      delivery_type: 'immediate',
      priority: 'urgent',
      special_prep_instructions: 'Curry cut medium pieces',
      payment_method: 'cod',
      delivery_charge_paise: 3500,
    }, 1);

    assert(delivery.id > 0, `Delivery order generated: ${delivery.delivery_number}`);
    assert(delivery.status === 'pending' || delivery.status === 'order_created', `Initial status is ${delivery.status}`);
    assert(Boolean(delivery.otp_code) && delivery.otp_code!.length === 4, `4-digit OTP generated: ${delivery.otp_code}`);

    // Step through lifecycle
    const prep = deliveryService.updateDeliveryStatus(delivery.id, 'preparing', 1, 'CASHIER');
    assert(prep.status === 'preparing', 'State transitioned: order_created -> preparing');

    const ready = deliveryService.updateDeliveryStatus(delivery.id, 'ready_for_dispatch', 1, 'CASHIER');
    assert(ready.status === 'ready_for_dispatch', 'State transitioned: preparing -> ready_for_dispatch');

    const assigned = deliveryService.assignDriver(delivery.id, driverId, 1);
    assert(assigned.status === 'assigned' && assigned.driver_id === driverId, 'Driver assigned and status changed to assigned');

    const transit = deliveryService.updateDeliveryStatus(delivery.id, 'out_for_delivery', 1, 'CASHIER');
    assert(transit.status === 'out_for_delivery', 'State transitioned: assigned -> out_for_delivery');

    // STEP 4: OTP Verification & Delivery Completion
    console.log('\n[STEP 4] Testing OTP Verification and COD Collection...');
    const otpRes = deliveryService.verifyDeliveryOTP(delivery.id, delivery.otp_code!, 1);
    assert(otpRes.success === true, '4-digit OTP verified successfully');

    const completed = deliveryService.getDeliveryById(delivery.id);
    assert(completed?.status === 'delivered', 'Delivery marked delivered on OTP verification');
    assert(completed?.otp_verified === 1, 'OTP verified flag set to 1');

    // Record COD Collection
    const expectedCOD = delivery.total_paise;
    const codRes = deliveryService.recordCODCollection(delivery.id, expectedCOD, 1);
    assert(codRes.cod_collected_paise === expectedCOD, `COD collection of ₹${(expectedCOD/100).toFixed(2)} recorded`);
    assert(codRes.cod_variance_paise === 0, 'Zero variance recorded on exact collection');

    // Reconcile Driver Shift COD
    const recon = deliveryService.reconcileDriverShiftCOD(driverId, null, 1, 'Verified by cashier');
    assert(recon.status === 'verified', 'Driver shift COD reconciled and verified');
    assert(recon.total_collected_paise === expectedCOD, 'Reconciled amount matches shift total');

    // STEP 5: Delivery BI Reports
    console.log('\n[STEP 5] Testing Delivery BI & Report Engine Queries...');
    const txnReport = reportEngine.runReport({
      reportId: 'delivery_transactions_report',
    });
    assert(txnReport.rows.length >= 1, `Delivery Transactions Report returned ${txnReport.rows.length} rows`);
    assert(txnReport.columns.some(c => c.id === 'delivery_number'), 'Report contains delivery_number column');

    const perfReport = reportEngine.runReport({
      reportId: 'delivery_performance_report',
    });
    assert(perfReport.rows.length >= 1, `Delivery Performance Report returned ${perfReport.rows.length} rows`);

    const driverReport = reportEngine.runReport({
      reportId: 'driver_performance_report',
    });
    assert(driverReport.rows.length >= 1, `Driver Performance Report returned ${driverReport.rows.length} rows`);

    const profitReport = reportEngine.runReport({
      reportId: 'delivery_profitability_report',
    });
    assert(profitReport.rows.length >= 1, `Delivery Profitability Report returned ${profitReport.rows.length} rows`);

    const zoneReport = reportEngine.runReport({
      reportId: 'delivery_zone_report',
    });
    assert(zoneReport.rows.length >= 1, `Delivery Zone Report returned ${zoneReport.rows.length} rows`);

    console.log(`\n=============================================================`);
    console.log(`   DELIVERY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=============================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Test execution fatal error:', err);
    process.exit(1);
  }
}

if (app) {
  app.whenReady().then(runDeliveryTests);
} else {
  runDeliveryTests();
}
