import { IPlugin, IPluginContext, IPrinterDriver, IScaleDriver, IPaymentGateway, IExportFormat } from './plugin_interface';
import { configService } from '../config/config_service';
import { databaseProvider } from '../database/database_provider';
import { eventBus } from '../events/event_bus';
import { logger } from '../backend/logger';

export class PluginManager implements IPluginContext {
  public readonly config = configService;
  public readonly database = databaseProvider;
  public readonly events = eventBus;

  private plugins = new Map<string, IPlugin>();
  private printerDrivers = new Map<string, IPrinterDriver>();
  private scaleDrivers = new Map<string, IScaleDriver>();
  private paymentGateways = new Map<string, IPaymentGateway>();
  private exportFormats = new Map<string, IExportFormat>();

  public registerPrinterDriver(id: string, driver: IPrinterDriver): void {
    this.printerDrivers.set(id, driver);
    logger.info(`Registered printer driver plugin: ${id}`);
  }

  public registerScaleDriver(id: string, driver: IScaleDriver): void {
    this.scaleDrivers.set(id, driver);
    logger.info(`Registered weighing scale driver plugin: ${id}`);
  }

  public registerPaymentGateway(id: string, gateway: IPaymentGateway): void {
    this.paymentGateways.set(id, gateway);
    logger.info(`Registered payment gateway plugin: ${id}`);
  }

  public registerExportFormat(id: string, exporter: IExportFormat): void {
    this.exportFormats.set(id, exporter);
    logger.info(`Registered export format plugin: ${id}`);
  }

  public async registerPlugin(plugin: IPlugin): Promise<void> {
    try {
      logger.info(`Loading plugin: ${plugin.name} v${plugin.version}...`);
      await plugin.initialize(this);
      this.plugins.set(plugin.id, plugin);
      logger.info(`Successfully loaded plugin: ${plugin.name}`);
    } catch (err) {
      logger.error(`Failed to initialize plugin: ${plugin.name}`, err);
    }
  }

  public getPrinterDriver(id: string): IPrinterDriver | undefined {
    return this.printerDrivers.get(id);
  }

  public getScaleDriver(id: string): IScaleDriver | undefined {
    return this.scaleDrivers.get(id);
  }

  public getPaymentGateway(id: string): IPaymentGateway | undefined {
    return this.paymentGateways.get(id);
  }

  public getExportFormat(id: string): IExportFormat | undefined {
    return this.exportFormats.get(id);
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down all plugins...');
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.shutdown();
        logger.info(`Plugin shutdown: ${plugin.name}`);
      } catch (err) {
        logger.error(`Error shutting down plugin: ${plugin.name}`, err);
      }
    }
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;
