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
  enableMeatMode: z.boolean().default(true), // Default true for Meat Shop POS
  enableManufacturing: z.boolean().default(false),
  enablePharmacy: z.boolean().default(false),
});

// Receipt Template Schema
export const ReceiptTemplateSchema = z.object({
  paperWidth: z.enum(['58mm', '80mm']).default('80mm'),
  headerMessage: z.string().default('Fresh Quality Meats Daily'),
  footerMessage: z.string().default('Thank you for your business! Visit again.'),
  showGstBreakdown: z.boolean().default(true),
  autoPrintOnComplete: z.boolean().default(true),
});

// App Config Schema
export const AppConfigSchema = z.object({
  env: z.enum(['development', 'testing', 'production']).default('development'),
  dbPath: z.string(),
  shopInfo: z.object({
    name: z.string().default('Meat Shop POS'),
    address: z.string().default('123 Main Street'),
    phone: z.string().default('+91 9999999999'),
    gstin: z.string().default(''),
    currencySymbol: z.string().default('₹'),
  }),
  theme: z.enum(['light', 'dark']).default('dark'),
  taxes: z.object({
    defaultGstPercent: z.number().default(5), // Default 5% tax
    cessPercent: z.number().default(0),
  }),
  hardware: z.object({
    printerName: z.string().default(''),
    scalePort: z.string().default(''),
    scaleBaudRate: z.number().default(9600),
    barcodeScannerEnabled: z.boolean().default(true),
  }),
  receiptTemplate: ReceiptTemplateSchema.default({}),
  backup: z.object({
    backupDir: z.string().default(''),
    autoBackupOnClose: z.boolean().default(true),
    maxBackupsToKeep: z.number().default(7),
  }),
  logging: z.object({
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
    enableFileLogging: z.boolean().default(true),
  }),
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
      theme: 'dark',
      taxes: {
        defaultGstPercent: 5,
        cessPercent: 0,
      },
      hardware: {
        printerName: '',
        scalePort: '',
        scaleBaudRate: 9600,
        barcodeScannerEnabled: true,
      },
      receiptTemplate: {
        paperWidth: '80mm',
        headerMessage: 'Fresh Quality Meats Daily',
        footerMessage: 'Thank you for your business! Visit again.',
        showGstBreakdown: true,
        autoPrintOnComplete: true,
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
      
      // In development mode, ensure dbPath always points to process.cwd()/dev.db
      // to prevent stale cached paths from AppData overriding current working directory
      if (env === 'development' || !parsedData.dbPath) {
        parsedData.dbPath = defaultDbPath;
      }

      const validated = AppConfigSchema.parse({
        ...defaults,
        ...parsedData,
        env, // Environment is runtime context-driven
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
        shopInfo: { ...this.currentConfig.shopInfo, ...newConfig.shopInfo },
        taxes: { ...this.currentConfig.taxes, ...newConfig.taxes },
        hardware: { ...this.currentConfig.hardware, ...newConfig.hardware },
        receiptTemplate: { ...this.currentConfig.receiptTemplate, ...newConfig.receiptTemplate },
        backup: { ...this.currentConfig.backup, ...newConfig.backup },
        logging: { ...this.currentConfig.logging, ...newConfig.logging },
        featureFlags: { ...this.currentConfig.featureFlags, ...newConfig.featureFlags },
      };

      
      const validated = AppConfigSchema.parse(merged);
      this.currentConfig = validated;
      this.save();
      logger.info('Configuration updated successfully');
      return this.currentConfig;
    } catch (err) {
      logger.error('Failed to update config due to validation error', err);
      throw err;
    }
  }

  public getFlags(): FeatureFlags {
    return this.currentConfig.featureFlags;
  }

  public toggleFlag(flag: keyof FeatureFlags, enabled: boolean): FeatureFlags {
    const updatedFlags = { ...this.currentConfig.featureFlags, [flag]: enabled };
    this.update({ featureFlags: updatedFlags });
    return this.getFlags();
  }

  private save() {
    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to write configuration file', err);
    }
  }
}

export const configService = new ConfigService();
