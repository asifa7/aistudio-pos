import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { z } from 'zod';
import { logger } from '../backend/logger';

// Feature Flags Schema
export const FeatureFlagsSchema = z.object({
  enableLoyalty: z.boolean().default(false),
  enableCRM: z.boolean().default(false),
  enableCloudSync: z.boolean().default(false),
  enableRestaurantMode: z.boolean().default(false),
  enableMeatMode: z.boolean().default(true),
  enableManufacturing: z.boolean().default(false),
  enablePharmacy: z.boolean().default(false),
});

// Shop Info Schema
export const ShopInfoSchema = z.object({
  name: z.string().default('Meat Shop POS'),
  address: z.string().default('123 Main Street'),
  phone: z.string().default('+91 9999999999'),
  gstin: z.string().default(''),
  currencySymbol: z.string().default('₹'),
});

// Business Identity Schema
export const BusinessSchema = z.object({
  logoPath: z.string().default(''),
  email: z.string().default(''),
  pan: z.string().default(''),
  financialYear: z.string().default('2026-2027'),
});

// Invoice & Billing Numbering Schema
export const InvoiceSchema = z.object({
  numberingMode: z.enum(['continuous', 'reset_annual', 'custom']).default('continuous'),
  prefix: z.string().default('INV-'),
  startingNumber: z.number().int().min(1).default(1),
  termsAndConditions: z.string().default('Goods once sold cannot be returned without receipt.'),
  copiesCount: z.number().int().min(1).max(5).default(1),
});

// Tax / GST Schema
export const TaxSchema = z.object({
  gstEnabled: z.boolean().default(true),
  pricingMode: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  defaultGstPercent: z.number().default(5),
  taxRounding: z.enum(['none', 'nearest', 'up', 'down']).default('nearest'),
  rates: z.array(z.number()).default([0, 5, 12, 18, 28]),
});

// Payment Methods Schema
export const PaymentsSchema = z.object({
  enabledMethods: z.array(z.enum(['cash', 'card', 'upi', 'bank_transfer', 'credit', 'split'])).default(['cash', 'upi', 'card', 'split']),
  defaultPaymentMethod: z.enum(['cash', 'card', 'upi', 'credit', 'split']).default('cash'),
  allowSplit: z.boolean().default(true),
  allowCredit: z.boolean().default(true),
});

// Cash Box & Shift Rules Schema
export const CashboxSchema = z.object({
  enableShifts: z.boolean().default(true),
  requireOpeningCash: z.boolean().default(true),
  requireClosingCashCount: z.boolean().default(true),
  denominationsEnabled: z.array(z.number()).default([500, 200, 100, 50, 20, 10, 5, 2, 1]),
  allowWithdrawal: z.boolean().default(true),
  allowDeposit: z.boolean().default(true),
  allowAdjustment: z.boolean().default(true),
  managerApprovalRequired: z.boolean().default(false),
  discrepancyThresholdPaise: z.number().default(50000), // ₹500
});

// Inventory Rules Schema
export const InventorySchema = z.object({
  trackingEnabled: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(true),
  defaultLowStockThreshold: z.number().default(5),
  alertLowStock: z.boolean().default(true),
  alertOutOfStock: z.boolean().default(true),
  valuationMethod: z.enum(['FIFO', 'Weighted_Average']).default('FIFO'),
  batchTracking: z.boolean().default(true),
  expiryTracking: z.boolean().default(true),
  defaultUnit: z.enum(['kg', 'g', 'piece', 'pack']).default('kg'),
});

// Returns & Refunds Schema
export const ReturnsSchema = z.object({
  returnsEnabled: z.boolean().default(true),
  returnPeriodDays: z.number().default(7),
  allowPartialReturn: z.boolean().default(true),
  allowExchange: z.boolean().default(true),
  refundToOriginal: z.boolean().default(true),
  cashRefund: z.boolean().default(true),
  storeCredit: z.boolean().default(true),
  requireReturnReason: z.boolean().default(true),
  managerApproval: z.boolean().default(false),
  autoRestock: z.boolean().default(true),
});

// Hardware & Peripheral Schema
export const HardwareSchema = z.object({
  printerName: z.string().default(''),
  scalePort: z.string().default(''),
  scaleBaudRate: z.number().default(9600),
  barcodeScannerEnabled: z.boolean().default(true),
  cashDrawerEnabled: z.boolean().default(true),
});

// Receipt Template Schema
export const ReceiptTemplateSchema = z.object({
  paperWidth: z.enum(['58mm', '80mm', 'A4']).default('80mm'),
  headerMessage: z.string().default('Fresh Quality Meats Daily'),
  footerMessage: z.string().default('Thank you for your business! Visit again.'),
  showGstBreakdown: z.boolean().default(true),
  autoPrintOnComplete: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  showHsn: z.boolean().default(true),
  showDiscount: z.boolean().default(true),
  showCashier: z.boolean().default(true),
  showCustomer: z.boolean().default(true),
});

// Billing Settings Schema (single source of truth for payment/print flags)
export const BillingSettingsSchema = z.object({
  skipPaymentConfirmation: z.boolean().default(false),
  enableCalculatorWidget: z.boolean().default(true),
  defaultPaymentMethod: z.enum(['cash', 'upi', 'card', 'split', 'credit']).default('cash'),
});

// Full App Config Schema
export const AppConfigSchema = z.object({
  env: z.enum(['development', 'testing', 'production']).default('development'),
  dbPath: z.string(),
  shopInfo: ShopInfoSchema.default({}),
  business: BusinessSchema.default({}),
  invoice: InvoiceSchema.default({}),
  tax: TaxSchema.default({}),
  payments: PaymentsSchema.default({}),
  cashbox: CashboxSchema.default({}),
  inventory: InventorySchema.default({}),
  returns: ReturnsSchema.default({}),
  theme: z.enum(['light', 'dark']).default('dark'),
  hardware: HardwareSchema.default({}),
  receiptTemplate: ReceiptTemplateSchema.default({}),
  billingSettings: BillingSettingsSchema.default({}),
  backup: z.object({
    backupDir: z.string().default(''),
    autoBackupOnClose: z.boolean().default(true),
    maxBackupsToKeep: z.number().default(7),
  }).default({}),
  logging: z.object({
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
    enableFileLogging: z.boolean().default(true),
  }).default({}),
  featureFlags: FeatureFlagsSchema.default({}),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

export interface IConfigService {
  get(): AppConfig;
  update(newConfig: Partial<AppConfig>): AppConfig;
  getFlags(): FeatureFlags;
  toggleFlag(flag: keyof FeatureFlags, enabled: boolean): FeatureFlags;
}

export class ConfigService implements IConfigService {
  private configFilePath: string;
  private currentConfig!: AppConfig;

  constructor() {
    const isDev = process.env.NODE_ENV === 'development' || !app?.isPackaged;
    const env = isDev ? 'development' : 'production';
    
    let userDataPath: string;
    try {
      userDataPath = app.getPath('userData');
    } catch {
      userDataPath = process.cwd();
    }

    this.configFilePath = path.join(userDataPath, 'config.json');
    this.load(env, userDataPath);
  }

  private load(env: 'development' | 'testing' | 'production', userDataPath: string) {
    const defaultDbPath = env === 'production' 
      ? path.join(userDataPath, 'data.db') 
      : path.join(process.cwd(), 'dev.db');

    const defaultBackupDir = path.join(userDataPath, 'backups');

    const defaults: AppConfig = {
      env,
      dbPath: defaultDbPath,
      shopInfo: {
        name: 'My Premium Meat Shop',
        address: '123 Market Square, Bangalore',
        phone: '+91 98765 43210',
        gstin: '29AAAAA0000A1Z5',
        currencySymbol: '₹',
      },
      business: {
        logoPath: '',
        email: '',
        pan: '',
        financialYear: '2026-2027',
      },
      invoice: {
        numberingMode: 'continuous',
        prefix: 'INV-',
        startingNumber: 1,
        termsAndConditions: 'Goods once sold cannot be returned without receipt.',
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
        enabledMethods: ['cash', 'upi', 'card', 'split'],
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
        managerApprovalRequired: false,
        discrepancyThresholdPaise: 50000,
      },
      inventory: {
        trackingEnabled: true,
        allowNegativeStock: true,
        defaultLowStockThreshold: 5,
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
      theme: 'dark',
      hardware: {
        printerName: '',
        scalePort: '',
        scaleBaudRate: 9600,
        barcodeScannerEnabled: true,
        cashDrawerEnabled: true,
      },
      receiptTemplate: {
        paperWidth: '80mm',
        headerMessage: 'Fresh Quality Meats Daily',
        footerMessage: 'Thank you for your business! Visit again.',
        showGstBreakdown: true,
        autoPrintOnComplete: true,
        showLogo: true,
        showHsn: true,
        showDiscount: true,
        showCashier: true,
        showCustomer: true,
      },
      billingSettings: {
        skipPaymentConfirmation: false,
        enableCalculatorWidget: true,
        defaultPaymentMethod: 'cash',
      },
      backup: {
        backupDir: defaultBackupDir,
        autoBackupOnClose: true,
        maxBackupsToKeep: 7,
      },
      logging: {
        level: 'INFO',
        enableFileLogging: true,
      },
      featureFlags: {
        enableLoyalty: false,
        enableCRM: false,
        enableCloudSync: false,
        enableRestaurantMode: false,
        enableMeatMode: true,
        enableManufacturing: false,
        enablePharmacy: false,
      },
    };

    if (!fs.existsSync(this.configFilePath)) {
      this.currentConfig = defaults;
      this.save();
      logger.info('Created default configuration file', { path: this.configFilePath });
      return;
    }

    try {
      const fileData = fs.readFileSync(this.configFilePath, 'utf-8');
      const parsedData = JSON.parse(fileData);
      
      if (env === 'development' || !parsedData.dbPath) {
        parsedData.dbPath = defaultDbPath;
      }

      const validated = AppConfigSchema.parse({
        ...defaults,
        ...parsedData,
        env,
      });

      this.currentConfig = validated;
      logger.info('Configuration service loaded successfully', { env: this.currentConfig.env, dbPath: this.currentConfig.dbPath });
    } catch (err) {
      logger.error('Failed to parse config file, reverting to defaults', err);
      this.currentConfig = defaults;
      this.save();
    }
  }

  public get(): AppConfig {
    return this.currentConfig;
  }

  public update(newConfig: Partial<AppConfig>): AppConfig {
    try {
      const merged = {
        ...this.currentConfig,
        ...newConfig,
        shopInfo: { ...this.currentConfig.shopInfo, ...(newConfig.shopInfo || {}) },
        business: { ...(this.currentConfig.business || {}), ...(newConfig.business || {}) },
        invoice: { ...(this.currentConfig.invoice || {}), ...(newConfig.invoice || {}) },
        tax: { ...(this.currentConfig.tax || {}), ...(newConfig.tax || {}) },
        payments: { ...(this.currentConfig.payments || {}), ...(newConfig.payments || {}) },
        cashbox: { ...(this.currentConfig.cashbox || {}), ...(newConfig.cashbox || {}) },
        inventory: { ...(this.currentConfig.inventory || {}), ...(newConfig.inventory || {}) },
        returns: { ...(this.currentConfig.returns || {}), ...(newConfig.returns || {}) },
        hardware: { ...this.currentConfig.hardware, ...(newConfig.hardware || {}) },
        receiptTemplate: { ...(this.currentConfig.receiptTemplate || {}), ...(newConfig.receiptTemplate || {}) },
        billingSettings: { ...(this.currentConfig.billingSettings || {}), ...(newConfig.billingSettings || {}) },
        backup: { ...this.currentConfig.backup, ...(newConfig.backup || {}) },
        logging: { ...this.currentConfig.logging, ...(newConfig.logging || {}) },
        featureFlags: { ...this.currentConfig.featureFlags, ...(newConfig.featureFlags || {}) },
      };

      const validated = AppConfigSchema.parse(merged);
      this.currentConfig = validated;
      this.save();
      logger.info('Application configuration updated successfully');
      return this.currentConfig;
    } catch (err) {
      logger.error('Failed to update configuration', err);
      throw err;
    }
  }

  public getFlags(): FeatureFlags {
    return this.currentConfig.featureFlags;
  }

  public toggleFlag(flag: keyof FeatureFlags, enabled: boolean): FeatureFlags {
    this.currentConfig.featureFlags[flag] = enabled;
    this.save();
    logger.info('Feature flag toggled', { flag, enabled });
    return this.currentConfig.featureFlags;
  }

  private save() {
    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save configuration to file', err);
      throw err;
    }
  }
}

export const configService = new ConfigService();
export default configService;
