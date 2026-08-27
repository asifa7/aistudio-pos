import { app } from 'electron';
import { ACCENT_COLORS } from '../theme/palette';
import { AppConfigSchema } from '../config/config_service';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';

function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const a = [r, g, b].map(v => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

app.whenReady().then(async () => {
  console.log('\n======================================================');
  console.log('   STARTING SETTINGS & ACCENT PALETTE TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------------
    // 1. ACCENT PALETTE TESTS
    // -------------------------------------------------------------------
    console.log('\n--- 1. Testing Accent Palette (10 Colors & WCAG AA Contrast) ---');
    
    assert(ACCENT_COLORS.length === 10, 'ACCENT_COLORS must contain exactly 10 colors', `Got ${ACCENT_COLORS.length}`);

    const existingIds = ['teal', 'green', 'orange', 'slate'];
    for (const id of existingIds) {
      assert(ACCENT_COLORS.some(c => c.id === id), `Original ID '${id}' must be preserved`);
    }

    const newIds = ['sky', 'blue', 'indigo', 'violet', 'fuchsia', 'rose'];
    for (const id of newIds) {
      assert(ACCENT_COLORS.some(c => c.id === id), `New industry standard ID '${id}' must exist`);
    }

    for (const color of ACCENT_COLORS) {
      assert(/^#[0-9a-fA-F]{6}$/.test(color.hex), `Color ${color.id} hex ${color.hex} must be valid hex`);
      assert(/^#[0-9a-fA-F]{6}$/.test(color.hover), `Color ${color.id} hover ${color.hover} must be valid hex`);
      assert(/^#[0-9a-fA-F]{6}$/.test(color.active), `Color ${color.id} active ${color.active} must be valid hex`);
      assert(/^#[0-9a-fA-F]{6}$/.test(color.tint50), `Color ${color.id} tint50 ${color.tint50} must be valid hex`);
      assert(/^#[0-9a-fA-F]{6}$/.test(color.tint100), `Color ${color.id} tint100 ${color.tint100} must be valid hex`);

      const contrastWithWhite = getContrastRatio('#ffffff', color.hex);
      assert(
        contrastWithWhite >= 4.5,
        `Color '${color.name}' (${color.hex}) contrast with white is ${contrastWithWhite.toFixed(2)}:1 (must be >= 4.5:1 for WCAG AA)`
      );
    }

    // -------------------------------------------------------------------
    // 2. CONFIG SCHEMA & SERIALIZATION TESTS
    // -------------------------------------------------------------------
    console.log('\n--- 2. Testing AppConfigSchema Zod Validation & Defaults ---');

    const sampleConfig = {
      env: 'development',
      dbPath: 'dev.db',
      shopInfo: {
        name: 'Ishanth Proteins',
        address: '123 Market Road, Bangalore',
        phone: '+91 9876543210',
        gstin: '29AAAAA0000A1Z5',
        currencySymbol: '₹',
      },
      business: {
        logoPath: '',
        email: 'contact@ishanthproteins.com',
        pan: 'ABCDE1234F',
        financialYear: '2026-2027',
      },
      invoice: {
        numberingMode: 'continuous',
        prefix: 'INV-',
        startingNumber: 1001,
        termsAndConditions: 'Goods once sold cannot be returned without original receipt.',
        copiesCount: 1,
      },
      tax: {
        gstEnabled: true,
        pricingMode: 'exclusive',
        defaultGstPercent: 5,
        taxRounding: 'nearest',
        rates: [0, 5, 12, 18, 28],
      },
      payments: {
        enabledMethods: ['cash', 'upi', 'card', 'split', 'credit'],
        defaultPaymentMethod: 'cash',
        allowSplit: true,
        allowCredit: true,
      },
      cashbox: {
        enableShifts: true,
        requireOpeningCash: true,
        requireClosingCashCount: true,
        denominationsEnabled: [500, 200, 100, 50, 20, 10, 5, 2, 1],
        allowWithdrawal: true,
        allowDeposit: true,
        allowAdjustment: true,
        managerApprovalRequired: true,
        discrepancyThresholdPaise: 50000,
      },
      inventory: {
        trackingEnabled: true,
        allowNegativeStock: true,
        defaultLowStockThreshold: 10,
        alertLowStock: true,
        alertOutOfStock: true,
        valuationMethod: 'FIFO',
        batchTracking: true,
        expiryTracking: true,
        defaultUnit: 'kg',
      },
      returns: {
        returnsEnabled: true,
        returnPeriodDays: 7,
        allowPartialReturn: true,
        allowExchange: true,
        refundToOriginal: true,
        cashRefund: true,
        storeCredit: true,
        requireReturnReason: true,
        managerApproval: false,
        autoRestock: true,
      },
      hardware: {
        printerName: 'XP-58',
        scalePort: 'COM3',
        scaleBaudRate: 9600,
        barcodeScannerEnabled: true,
        cashDrawerEnabled: true,
      },
      receiptTemplate: {
        paperWidth: '80mm',
        headerMessage: 'Fresh Quality Meats Daily',
        footerMessage: 'Thank you for your visit!',
        showGstBreakdown: true,
        autoPrintOnComplete: true,
        showLogo: true,
        showHsn: true,
        showDiscount: true,
        showCashier: true,
        showCustomer: true,
      },
      billingSettings: {
        skipPaymentConfirmation: true,
        enableCalculatorWidget: true,
        defaultPaymentMethod: 'cash',
      },
    };

    const parsedConfig = AppConfigSchema.parse(sampleConfig);
    assert(parsedConfig.business?.email === 'contact@ishanthproteins.com', 'Business email parsed correctly');
    assert(parsedConfig.invoice?.prefix === 'INV-', 'Invoice prefix parsed correctly');
    assert(parsedConfig.tax?.pricingMode === 'exclusive', 'Tax pricing mode parsed correctly');
    assert(parsedConfig.payments?.defaultPaymentMethod === 'cash', 'Payments default parsed correctly');
    assert(parsedConfig.cashbox?.requireOpeningCash === true, 'Cashbox requireOpeningCash parsed correctly');
    assert(parsedConfig.inventory?.defaultUnit === 'kg', 'Inventory defaultUnit parsed correctly');
    assert(parsedConfig.returns?.returnPeriodDays === 7, 'Returns returnPeriodDays parsed correctly');
    assert(parsedConfig.billingSettings?.skipPaymentConfirmation === true, 'BillingSettings flag preserved');

    // Test backward compatibility: minimal legacy config parsing
    const legacyMinimal = {
      dbPath: 'dev.db',
    };
    const parsedLegacy = AppConfigSchema.parse(legacyMinimal);
    assert(parsedLegacy.shopInfo.name !== '', 'Default shopInfo provided when omitted');
    assert(parsedLegacy.receiptTemplate.paperWidth === '80mm', 'Default receiptTemplate provided when omitted');
    assert(parsedLegacy.tax?.gstEnabled === true, 'Default tax settings provided when omitted');

    // -------------------------------------------------------------------
    // 3. SQLITE MIGRATION & ROLE PERMISSIONS TESTS
    // -------------------------------------------------------------------
    console.log('\n--- 3. Testing SQLite Migration 046 & Role Permissions ---');
    migrationEngine.run();

    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='role_permissions'").get() as { name: string } | undefined;
    assert(tableCheck !== undefined && tableCheck.name === 'role_permissions', 'role_permissions table exists in SQLite');

    const adminPerms = db.prepare("SELECT COUNT(*) as count FROM role_permissions WHERE role = 'ADMIN'").get() as { count: number };
    assert(adminPerms.count > 0, `ADMIN role has ${adminPerms.count} seeded permissions`);

    const cashierRefund = db.prepare("SELECT allowed FROM role_permissions WHERE role = 'CASHIER' AND permission_key = 'refund'").get() as { allowed: number } | undefined;
    assert(cashierRefund !== undefined, 'CASHIER refund permission row exists');

    console.log('\n======================================================');
    console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
    app.exit(0);
  } catch (error: any) {
    console.error('\n[FATAL TEST ERROR]', error.message);
    if (error.stack) console.error(error.stack);
    app.exit(1);
  }
});
