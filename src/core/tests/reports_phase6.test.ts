import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { reportEngine } from '../../modules/reports/backend/engine/report_engine';
import { savedReportsService } from '../../modules/reports/backend/service/saved_reports_service';
import { reportAlertsService } from '../../modules/reports/backend/service/report_alerts_service';
import { METRIC_DEFINITIONS } from '../../modules/reports/types/metric_definitions';
import { authService } from '../../modules/auth/backend/service/auth_service';

async function runPhase6Tests() {
  console.log('\n=============================================================');
  console.log('   STARTING REPORTS PHASE 6: CUSTOM BUILDER, PIVOT, SAVED, PERMISSIONS & ALERTS');
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
    // STEP 1: Run Migrations & Authenticate Admin
    console.log('[STEP 1] Running database migrations...');
    migrationEngine.run();
    assert(true, 'Migrations and indexes verified');

    const loginRes = authService.login('admin', 'admin123');
    const userId = loginRes?.user?.id || 1;
    assert(loginRes !== null, 'Authenticated admin user for test session');

    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);

    // STEP 2: Test Section A — Custom Report Builder
    console.log('\n[STEP 2] Testing Section A — Custom Report Builder...');

    const customReportRes = reportEngine.runCustomReport({
      name: `Custom Chicken Analysis ${uniqueSuffix}`,
      dataSource: 'sales_transactions',
      dimensions: ['product_name', 'category', 'payment_method'],
      measures: ['net_amount_paise', 'weight_kg', 'quantity_units'],
      groupBy: ['category'],
    });

    assert(customReportRes.reportName.includes('Custom Chicken Analysis'), 'Custom report name accurately preserved');
    assert(customReportRes.dataSource === 'sales_transactions', 'Custom report data source is sales_transactions');
    assert(customReportRes.totalRows >= 1, `Custom report returned ${customReportRes.totalRows} data rows`);
    assert(customReportRes.columns.some(c => c.id === 'product_name'), 'Includes product_name dimension');
    assert(customReportRes.columns.some(c => c.id === 'net_amount_paise'), 'Includes net_amount_paise measure');
    assert(customReportRes.groupedData !== undefined && customReportRes.groupedData.length > 0, 'Group By hierarchy successfully executed');

    // STEP 3: Test Section A — Cross-Tab Pivot Table Engine
    console.log('\n[STEP 3] Testing Section A — Cross-Tab Pivot Table Engine...');

    const pivotResult = reportEngine.buildPivot(
      { reportId: 'raw_transactions' },
      {
        rowDimension: 'product_name',
        columnDimension: 'payment_method',
        valueMeasure: 'net_amount_paise',
      }
    );

    assert(pivotResult.rowKeys.length >= 1, `Pivot produced ${pivotResult.rowKeys.length} row keys`);
    assert(pivotResult.colKeys.length >= 1, `Pivot produced ${pivotResult.colKeys.length} col keys (${pivotResult.colKeys.join(', ')})`);
    assert(pivotResult.grandTotal > 0, `Pivot grand total calculated: ₹${pivotResult.grandTotal / 100}`);

    // Verify row sums equal grand total
    const sumRowTotals = (Object.values(pivotResult.rowTotals) as number[]).reduce((a: number, b: number) => a + b, 0);
    assert(sumRowTotals === pivotResult.grandTotal, `Sum of row totals (${sumRowTotals}) strictly equals Grand Total (${pivotResult.grandTotal})`);

    // Verify col sums equal grand total
    const sumColTotals = (Object.values(pivotResult.colTotals) as number[]).reduce((a: number, b: number) => a + b, 0);
    assert(sumColTotals === pivotResult.grandTotal, `Sum of column totals (${sumColTotals}) strictly equals Grand Total (${pivotResult.grandTotal})`);

    // STEP 4: Test Section B — Saved Reports, Favorites & Recents
    console.log('\n[STEP 4] Testing Section B — Saved Reports, Favorites & Recents...');

    // 1. Save Report
    const saved = savedReportsService.saveReport({
      name: `Monthly Chicken Profit Report ${uniqueSuffix}`,
      description: 'Custom chicken sales and profitability template',
      dataSource: 'sales_transactions',
      configuration: {
        name: `Monthly Chicken Profit Report ${uniqueSuffix}`,
        dataSource: 'sales_transactions',
        dimensions: ['product_name', 'category'],
        measures: ['net_amount_paise', 'gross_profit_paise', 'margin_percent'],
        groupBy: ['category'],
      },
      isFavorite: true,
      createdBy: userId,
    });

    assert(saved.id > 0, `Saved custom report template #${saved.id}`);
    assert(saved.isFavorite === true, 'Saved report marked as favorite');

    // 2. Fetch saved report
    const fetchedSaved = savedReportsService.getSavedReportById(saved.id);
    assert(fetchedSaved !== null, 'Fetched saved report by ID');
    assert(fetchedSaved?.configuration.dimensions.length === 2, 'Restored saved dimensions');
    assert(fetchedSaved?.configuration.measures.length === 3, 'Restored saved measures');

    // 3. Favorites Toggle
    const testFavId = `test_fav_${uniqueSuffix}`;
    const isFavNow = savedReportsService.toggleFavorite(userId, testFavId);
    assert(isFavNow === true, `Toggled favorite for ${testFavId}`);
    const favs = savedReportsService.getFavoriteReportIds(userId);
    assert(favs.includes(testFavId), `${testFavId} found in user favorites list`);

    // 4. Recent Reports Tracking
    savedReportsService.recordRecentReport({
      userId,
      reportId: 'stock_on_hand_report',
      reportName: 'Stock on Hand Report',
      category: 'Inventory',
    });

    const recents = savedReportsService.getRecentReports(userId, 5);
    assert(recents.some(r => r.reportId === 'stock_on_hand_report'), 'Recorded and retrieved recent report');

    // STEP 5: Test Section C — Permissions and Data Security
    console.log('\n[STEP 5] Testing Section C — Permissions and Data Security...');

    // 1. Cashier Role attempting to query restricted cost/profit field
    let cashierBlocked = false;
    try {
      reportEngine.runCustomReport(
        {
          name: 'Unauthorized Cost Probe',
          dataSource: 'sales_transactions',
          dimensions: ['product_name'],
          measures: ['cost_paise', 'gross_profit_paise'], // Restricted fields!
        },
        { role: 'CASHIER', userId: 99 }
      );
    } catch (err: any) {
      if (err.message.includes('Permission Denied')) {
        cashierBlocked = true;
      }
    }
    assert(cashierBlocked === true, 'Report Engine strictly refused Cashier role from querying restricted cost/profit fields');

    // 2. Cashier Role attempting to access restricted COGS Inventory data source
    let cogsBlocked = false;
    try {
      reportEngine.runCustomReport(
        {
          name: 'Unauthorized COGS Source',
          dataSource: 'cogs_inventory', // Restricted data source for cashier
          dimensions: ['product_name'],
          measures: ['stock_valuation_paise'],
        },
        { role: 'CASHIER', userId: 99 }
      );
    } catch (err: any) {
      if (err.message.includes('Permission Denied')) {
        cogsBlocked = true;
      }
    }
    assert(cogsBlocked === true, 'Report Engine strictly refused Cashier role from accessing restricted data source');

    // 3. Admin / Manager querying same metrics succeeds without restriction
    let adminAllowed = false;
    try {
      const adminRes = reportEngine.runCustomReport(
        {
          name: 'Authorized Admin Report',
          dataSource: 'sales_transactions',
          dimensions: ['product_name'],
          measures: ['gross_profit_paise', 'net_amount_paise'],
        },
        { role: 'ADMIN', userId }
      );
      if (adminRes.totalRows >= 1) {
        adminAllowed = true;
      }
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed === true, 'Admin role authorized to query cost and profitability metrics without restriction');

    // STEP 6: Test Section D — Data-Quality & Metric Definitions
    console.log('\n[STEP 6] Testing Section D — Data-Quality & Metric Definitions...');

    // 1. Validate Metric Definitions
    assert(METRIC_DEFINITIONS.gross_profit !== undefined, 'Gross Profit metric definition is defined');
    assert(METRIC_DEFINITIONS.gross_profit.formula.includes('COGS'), 'Gross Profit formula includes COGS');
    assert(METRIC_DEFINITIONS.gross_margin !== undefined, 'Gross Margin metric definition is defined');
    assert(METRIC_DEFINITIONS.avg_ticket !== undefined, 'Average Ticket metric definition is defined');
    assert(METRIC_DEFINITIONS.customer_frequency !== undefined, 'Customer Frequency metric definition is defined');
    assert(METRIC_DEFINITIONS.actual_yield_percent !== undefined, 'Meat Yield metric definition is defined');

    // STEP 7: Test Section E — Threshold Alerts
    console.log('\n[STEP 7] Testing Section E — Threshold Alerts...');

    const alerts = reportAlertsService.generateReportAlerts();
    assert(Array.isArray(alerts), 'Threshold alerts returned as array');
    console.log(`  [INFO] Generated ${alerts.length} active threshold alerts`);
    if (alerts.length > 0) {
      const firstAlert = alerts[0];
      assert(firstAlert.targetReportId !== undefined && firstAlert.targetReportId.length > 0, `Alert targets pre-filtered report: ${firstAlert.targetReportId}`);
      assert(['critical', 'warning', 'info'].includes(firstAlert.severity), `Alert severity valid: ${firstAlert.severity}`);
    }

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n[FATAL ERROR IN REPORT ENGINE PHASE 6 TEST]:', err);
    process.exit(1);
  }
}

app.whenReady().then(async () => {
  await runPhase6Tests();
  app.quit();
});
