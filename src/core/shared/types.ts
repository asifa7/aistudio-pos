export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  currencySymbol: string;
}

export interface BusinessConfig {
  logoPath?: string;
  email?: string;
  pan?: string;
  financialYear?: string;
}

export interface InvoiceConfig {
  numberingMode?: 'continuous' | 'reset_annual' | 'custom';
  prefix?: string;
  startingNumber?: number;
  termsAndConditions?: string;
  copiesCount?: number;
}

export interface TaxConfig {
  gstEnabled?: boolean;
  pricingMode?: 'inclusive' | 'exclusive';
  defaultGstPercent?: number;
  taxRounding?: 'none' | 'nearest' | 'up' | 'down';
  rates?: number[];
}

export interface PaymentsConfig {
  enabledMethods?: Array<'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit' | 'split'>;
  defaultPaymentMethod?: 'cash' | 'card' | 'upi' | 'credit' | 'split';
  allowSplit?: boolean;
  allowCredit?: boolean;
}

export interface CashboxConfig {
  enableShifts?: boolean;
  requireOpeningCash?: boolean;
  requireClosingCashCount?: boolean;
  denominationsEnabled?: number[];
  allowWithdrawal?: boolean;
  allowDeposit?: boolean;
  allowAdjustment?: boolean;
  managerApprovalRequired?: boolean;
  discrepancyThresholdPaise?: number;
}

export interface InventoryConfig {
  trackingEnabled?: boolean;
  allowNegativeStock?: boolean;
  defaultLowStockThreshold?: number;
  alertLowStock?: boolean;
  alertOutOfStock?: boolean;
  valuationMethod?: 'FIFO' | 'Weighted_Average';
  batchTracking?: boolean;
  expiryTracking?: boolean;
  defaultUnit?: 'kg' | 'g' | 'piece' | 'pack';
}

export interface ReturnsConfig {
  returnsEnabled?: boolean;
  returnPeriodDays?: number;
  allowPartialReturn?: boolean;
  allowExchange?: boolean;
  refundToOriginal?: boolean;
  cashRefund?: boolean;
  storeCredit?: boolean;
  requireReturnReason?: boolean;
  managerApproval?: boolean;
  autoRestock?: boolean;
}

export interface HardwareConfig {
  printerName?: string;
  scalePort?: string;
  scaleBaudRate?: number;
  barcodeScannerEnabled?: boolean;
  cashDrawerEnabled?: boolean;
}

export interface ReceiptTemplateConfig {
  paperWidth?: '58mm' | '80mm' | 'A4';
  headerMessage?: string;
  footerMessage?: string;
  showGstBreakdown?: boolean;
  autoPrintOnComplete?: boolean;
  showLogo?: boolean;
  showHsn?: boolean;
  showDiscount?: boolean;
  showCashier?: boolean;
  showCustomer?: boolean;
}

export interface BillingSettingsConfig {
  skipPaymentConfirmation?: boolean;
  enableCalculatorWidget?: boolean;
  defaultPaymentMethod?: 'cash' | 'upi' | 'card' | 'split' | 'credit';
}

export interface BackupConfig {
  backupDir?: string;
  autoBackupOnClose?: boolean;
  maxBackupsToKeep?: number;
}

export interface AppConfig {
  env: 'development' | 'testing' | 'production';
  dbPath: string;
  shopInfo: ShopInfo;
  business?: BusinessConfig;
  invoice?: InvoiceConfig;
  tax?: TaxConfig;
  payments?: PaymentsConfig;
  cashbox?: CashboxConfig;
  inventory?: InventoryConfig;
  returns?: ReturnsConfig;
  theme: 'light' | 'dark';
  hardware: HardwareConfig;
  receiptTemplate?: ReceiptTemplateConfig;
  billingSettings?: BillingSettingsConfig;
  backup?: BackupConfig;
}
