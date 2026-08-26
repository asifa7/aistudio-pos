import { IConfigService } from '../config/config_service';
import { IDatabaseProvider } from '../database/database_provider';
import { EventBus } from '../events/event_bus';

export interface IPlugin {
  id: string;
  name: string;
  version: string;
  initialize(context: IPluginContext): Promise<void> | void;
  shutdown(): Promise<void> | void;
}

export interface IPluginContext {
  config: IConfigService;
  database: IDatabaseProvider;
  events: EventBus;
  registerPrinterDriver(id: string, driver: IPrinterDriver): void;
  registerScaleDriver(id: string, driver: IScaleDriver): void;
  registerPaymentGateway(id: string, gateway: IPaymentGateway): void;
  registerExportFormat(id: string, exporter: IExportFormat): void;
}

export interface IPrinterDriver {
  printReceipt(content: string, options?: Record<string, any>): Promise<void>;
  printLabel(barcode: string, productName: string, rate: number, options?: Record<string, any>): Promise<void>;
  getStatus(): Promise<'ready' | 'offline' | 'error'>;
}

export interface IScaleDriver {
  readWeight(): Promise<{ success: boolean; grams: number; error?: string }>;
  connect(port: string, options?: Record<string, any>): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<'connected' | 'disconnected' | 'error'>;
}

export interface IPaymentGateway {
  initiatePayment(amountPaise: number, invoiceId: number): Promise<{ success: boolean; txnId?: string; error?: string }>;
  checkStatus(txnId: string): Promise<{ success: boolean; status: 'pending' | 'success' | 'failed' }>;
}

export interface IExportFormat {
  extension: string;
  mimeType: string;
  exportData(data: Record<string, any>[], options?: Record<string, any>): Promise<Buffer>;
}
