export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  currencySymbol: string;
}

export interface HardwareConfig {
  printerName: string;
  scalePort: string;
  scaleBaudRate: number;
  barcodeScannerEnabled: boolean;
}

export interface ReceiptTemplateConfig {
  paperWidth: '58mm' | '80mm';
  headerMessage: string;
  footerMessage: string;
  showGstBreakdown: boolean;
  autoPrintOnComplete: boolean;
}

export interface BillingSettingsConfig {
  skipPaymentConfirmation?: boolean;
  enableCalculatorWidget?: boolean;
  defaultPaymentMethod?: 'cash' | 'upi' | 'card' | 'split';
}

export interface AppConfig {
  env: 'development' | 'testing' | 'production';
  dbPath: string;
  shopInfo: ShopInfo;
  theme: 'light' | 'dark';
  hardware: HardwareConfig;
  receiptTemplate?: ReceiptTemplateConfig;
  billingSettings?: BillingSettingsConfig;
}

