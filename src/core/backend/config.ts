import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { z } from 'zod';
import { logger } from './logger';

// Zod Schema to validate the configurations
export const ConfigSchema = z.object({
  env: z.enum(['development', 'testing', 'production']),
  dbPath: z.string(),
  shopInfo: z.object({
    name: z.string().default('Meat Shop POS'),
    address: z.string().default('123 Main Street'),
    phone: z.string().default('+91 9999999999'),
    gstin: z.string().default(''),
    currencySymbol: z.string().default('₹'),
  }),
  theme: z.enum(['light', 'dark']).default('dark'),
  hardware: z.object({
    printerName: z.string().default(''),
    scalePort: z.string().default(''),
    scaleBaudRate: z.number().default(9600),
    barcodeScannerEnabled: z.boolean().default(true),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

class ConfigurationManager {
  private configFilePath: string;
  private currentConfig!: AppConfig;

  constructor() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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
      hardware: {
        printerName: '',
        scalePort: '',
        scaleBaudRate: 9600,
        barcodeScannerEnabled: true,
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
      
      // Perform validation and merge defaults for missing properties
      // In development mode, ensure dbPath always points to process.cwd()/dev.db
      // to prevent stale cached paths from AppData overriding current working directory
      if (env === 'development' || !parsedData.dbPath) {
        parsedData.dbPath = defaultDbPath;
      }

      const validated = ConfigSchema.parse({
        ...defaults,
        ...parsedData,
        // Override environment dynamically based on runtime context
        env,
      });

      this.currentConfig = validated;
      logger.info('Configuration loaded successfully', { env: this.currentConfig.env, dbPath: this.currentConfig.dbPath });
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
      const merged = { ...this.currentConfig, ...newConfig };
      const validated = ConfigSchema.parse(merged);
      this.currentConfig = validated;
      this.save();
      logger.info('Configuration updated successfully');
      return this.currentConfig;
    } catch (err) {
      logger.error('Failed to update config due to validation error', err);
      throw err;
    }
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

export const configManager = new ConfigurationManager();
export const config = configManager.get();
