import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { reportsService } from '../../modules/reports/backend/service/reports_service';
import { invoiceService } from '../../modules/billing/backend/service/invoice_service';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { creditService } from '../../modules/customers/backend/service/credit_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runTests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 1: REPORT ENGINE AUTOMATED TESTS');
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
    // STEP 1: Run Migrations including 052_reporting_engine_indexes.sql
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations and indexes completed successfully');

    // Authenticate test admin user
    const adminUser = authService.login('admin', 'admin123');
    assert(adminUser !== null, 'Logged in as test admin user');

    // STEP 2: Seed Test Data for Reporting Engine
    console.log('\n[STEP 2] Seeding test customer, products, and sales transactions...');
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const testPhone = `9811${uniqueSuffix}`;

    const testCust = customerService.createCustomer({
      name: `Report Test Customer ${uniqueSuffix}`,
      phone: testPhone,
      whatsapp: testPhone,
      category: 'Wholesale',
      credit_allowed: 1,
      credit_limit_paise: 1000000,
      opening_balance_paise: 0,
    });
    assert(testCust.id > 0, `Created test customer #${testCust.id}`);

    // Create Invoice 1: Cash payment, Chicken (1kg = 1000g)
    const draft1 = invoiceService.createDraft({ customer_id: testCust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft1.id, product_variant_id: 1, quantity_grams: 1000, quantity_units: null });
    const inv1Completed = invoiceService.completeInvoice({ invoiceId: draft1.id });
    const inv1 = inv1Completed.invoice;
    assert(inv1.id > 0, `Created Completed Invoice 1 #${inv1.invoice_number}`);

    // Create Invoice 2: UPI payment, Mutton/Other (2kg = 2000g)
    const draft2 = invoiceService.createDraft({ customer_id: testCust.id, is_gst_invoice: false });
    invoiceService.addItem({ invoice_id: draft2.id, product_variant_id: 2, quantity_grams: 2000, quantity_units: null });
    const inv2Completed = invoiceService.completeInvoice({ invoiceId: draft2.id });
    const inv2 = inv2Completed.invoice;
    // Record payment as UPI
    db.prepare("INSERT OR REPLACE INTO payments (invoice_id, amount_paise, method, reference_number, received_at) VALUES (?, ?, 'upi', ?, ?)")
      .run(inv2.id, inv2.total_paise, `UPI-TEST-${uniqueSuffix}`, new Date().toISOString());
    assert(inv2.id > 0, `Created Completed Invoice 2 #${inv2.invoice_number} (UPI)`);

    // STEP 3: Test Report Definitions Registry
    console.log('\n[STEP 3] Testing Report Definitions registry...');
    const defs = reportsService.getReportDefinitions();
    assert(defs.length >= 2, `Report catalog contains ${defs.length} definitions`);
    
    const rawDef = defs.find((d: any) => d.id === 'raw_transactions');
    assert(rawDef !== undefined, 'Raw Transactions definition exists');
    assert(rawDef?.dataSource === 'sales_transactions', 'Raw Transactions uses sales_transactions data source');

    const catDef = defs.find((d: any) => d.id === 'sales_by_category');
    assert(catDef !== undefined, 'Sales by Category definition exists');
    assert(catDef?.dataSource === 'sales_transactions', 'Sales by Category uses sales_transactions data source');

    // STEP 4: Run Master Raw Transactions Report (Section D)
    console.log('\n[STEP 4] Executing Master Raw Sales Transactions Report (Section D)...');
    const todayStr = new Date().toISOString().split('T')[0];
    const rawResult = reportEngine.runReport({
      reportId: 'raw_transactions',
      filters: {
        startDate: todayStr,
        endDate: todayStr,
      },
      page: 1,
      pageSize: 50,
    });

    assert(rawResult.reportId === 'raw_transactions', 'Report result returned for raw_transactions');
    assert(rawResult.totalRows >= 2, `Found ${rawResult.totalRows} raw transaction rows`);
    assert(rawResult.columns.length >= 20, `Raw Transactions includes ${rawResult.columns.length} columns`);
    assert(rawResult.columns.some((c: any) => c.id === 'invoice_number'), 'Includes invoice_number column');
    assert(rawResult.columns.some((c: any) => c.id === 'customer_name'), 'Includes customer_name column');
    assert(rawResult.columns.some((c: any) => c.id === 'product_name'), 'Includes product_name column');
    assert(rawResult.columns.some((c: any) => c.id === 'selling_price_paise'), 'Includes selling_price_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'gross_amount_paise'), 'Includes gross_amount_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'tax_paise'), 'Includes tax_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'net_amount_paise'), 'Includes net_amount_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'cost_paise'), 'Includes cost_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'gross_profit_paise'), 'Includes gross_profit_paise column');
    assert(rawResult.columns.some((c: any) => c.id === 'margin_percent'), 'Includes margin_percent column');
    assert(rawResult.columns.some((c: any) => c.id === 'payment_method'), 'Includes payment_method column');

    assert(rawResult.grandTotals.net_amount_paise > 0, `Grand total net amount: ₹${(rawResult.grandTotals.net_amount_paise / 100).toFixed(2)}`);
    assert((rawResult.kpiSummary?.totalTransactions ?? 0) >= 2, `KPI summary transactions count: ${rawResult.kpiSummary?.totalTransactions}`);

    // STEP 5: Run Sales by Category Report through the EXACT SAME code path (Section A)
    console.log('\n[STEP 5] Executing Sales by Category Report through the same engine pipeline (Section A)...');
    const catResult = reportEngine.runReport({
      reportId: 'sales_by_category',
      filters: {
        startDate: todayStr,
        endDate: todayStr,
      },
    });

    assert(catResult.reportId === 'sales_by_category', 'Report result returned for sales_by_category');
    assert(catResult.groupedData !== undefined, 'Grouped data is present for Category Report');
    assert(catResult.groupedData!.length > 0, `Found ${catResult.groupedData!.length} category groups`);
    
    // Check that sum of category net amounts strictly equals grand total net amount
    const sumCatNet = catResult.groupedData!.reduce((sum, g) => sum + (g.subtotals.net_amount_paise || 0), 0);
    assert(sumCatNet === catResult.grandTotals.net_amount_paise, `Category subtotals sum (${sumCatNet}) strictly equals Grand Total (${catResult.grandTotals.net_amount_paise})`);

    // STEP 6: Multi-filter Testing (Section B)
    console.log('\n[STEP 6] Testing multi-filter combination narrowing (Section B)...');
    
    // Filter by Payment Method: 'upi'
    const upiResult = reportEngine.runReport({
      reportId: 'raw_transactions',
      filters: {
        startDate: todayStr,
        endDate: todayStr,
        paymentMethod: 'upi',
      },
    });

    assert(upiResult.totalRows >= 1, `UPI filter returned ${upiResult.totalRows} rows`);
    assert(upiResult.rows.every(r => r.payment_method === 'upi'), 'All returned rows have payment_method = upi');

    // Multi-filter: Customer + Payment Method + Date Range
    const multiFilterResult = reportEngine.runReport({
      reportId: 'raw_transactions',
      filters: {
        startDate: todayStr,
        endDate: todayStr,
        customerId: testCust.id,
        paymentMethod: 'upi',
      },
    });

    assert(multiFilterResult.totalRows >= 1, `Multi-filter returned ${multiFilterResult.totalRows} rows`);
    assert(multiFilterResult.rows.every(r => r.customer_name.includes(String(uniqueSuffix))), 'Customer filter strictly applied');

    // STEP 7: Grouping and Subtotals (Section C)
    console.log('\n[STEP 7] Testing dynamic Grouping and Subtotals calculation (Section C)...');
    const groupedResult = reportEngine.runReport({
      reportId: 'raw_transactions',
      groupBy: ['payment_method'],
      filters: {
        startDate: todayStr,
        endDate: todayStr,
      },
    });

    assert(groupedResult.groupedData !== undefined && groupedResult.groupedData.length > 0, 'Grouped data generated for payment_method');
    const totalGroupRows = groupedResult.groupedData!.reduce((sum, g) => sum + g.count, 0);
    assert(totalGroupRows === groupedResult.totalRows, `Sum of group row counts (${totalGroupRows}) strictly equals totalRows (${groupedResult.totalRows})`);

    // STEP 8: Data Quality Warning Validation
    console.log('\n[STEP 8] Validating Data Quality Warning engine...');
    assert(Array.isArray(rawResult.dataQualityWarnings), 'Data quality warnings returned as array');

    // STEP 9: Export Engine Testing (Section E)
    console.log('\n[STEP 9] Testing Export Engine (Section E)...');
    const csvExport = reportsService.exportReport({
      reportId: 'raw_transactions',
      format: 'csv',
      scope: 'all_data',
      filters: {
        startDate: todayStr,
        endDate: todayStr,
      },
    });

    assert(csvExport.filename.endsWith('.csv'), `Export filename is ${csvExport.filename}`);
    assert(csvExport.mimeType === 'text/csv', 'MIME type is text/csv');
    assert(csvExport.content.includes('Report: Raw Sales Transactions Report'), 'CSV header includes Report Title');
    assert(csvExport.content.includes('GRAND TOTAL'), 'CSV contains GRAND TOTAL row');
    assert(csvExport.content.includes(inv1.invoice_number!), 'CSV includes invoice 1');
    assert(csvExport.content.includes(inv2.invoice_number!), 'CSV includes invoice 2');

    // STEP 10: Filter Options API
    console.log('\n[STEP 10] Testing Filter Options API...');
    const filterOptions = reportsService.getFilterOptions();
    assert(filterOptions.categories.length > 0, `Filter options returned ${filterOptions.categories.length} categories`);
    assert(filterOptions.cashiers.length > 0, `Filter options returned ${filterOptions.cashiers.length} cashiers`);
    assert(filterOptions.paymentMethods.length > 0, `Filter options returned ${filterOptions.paymentMethods.length} payment methods`);

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE TEST]:', err);
    process.exit(1);
  } finally {
    setTimeout(() => {
      app.quit();
      process.exit(0);
    }, 500);
  }
}

app.whenReady().then(runTests);
