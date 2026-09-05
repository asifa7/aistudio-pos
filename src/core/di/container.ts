import { configService } from '../config/config_service';
import { databaseProvider } from '../database/database_provider';
import {
  UserRepository,
  ProductRepository,
  InvoiceRepository,
  PurchaseRepository,
  InventoryRepository,
  CustomerRepository,
  SupplierRepository,
  CashRepository,
  SettingsRepository,
  SupplierProfileRepository,
  PurchaseOrderRepository,
  GoodsReceiptRepository,
  PurchaseInvoiceRepository,
  SupplierLedgerRepository,
  SupplierPaymentRepository,
  SupplierReportRepository
} from '../database/repositories/repositories';

class ServiceContainer {
  // Database & Configurations
  public readonly configService = configService;
  public readonly databaseProvider = databaseProvider;

  // Repositories
  public readonly userRepository = new UserRepository(this.databaseProvider);
  public readonly productRepository = new ProductRepository(this.databaseProvider);
  public readonly invoiceRepository = new InvoiceRepository(this.databaseProvider);
  public readonly purchaseRepository = new PurchaseRepository(this.databaseProvider);
  public readonly inventoryRepository = new InventoryRepository(this.databaseProvider);
  public readonly customerRepository = new CustomerRepository(this.databaseProvider);
  public readonly supplierRepository = new SupplierRepository(this.databaseProvider);
  public readonly cashRepository = new CashRepository(this.databaseProvider);
  public readonly settingsRepository = new SettingsRepository(this.configService);
  
  // Enterprise Supplier & Procurement Repositories
  public readonly supplierProfileRepository = new SupplierProfileRepository(this.databaseProvider);
  public readonly purchaseOrderRepository = new PurchaseOrderRepository(this.databaseProvider);
  public readonly goodsReceiptRepository = new GoodsReceiptRepository(this.databaseProvider);
  public readonly purchaseInvoiceRepository = new PurchaseInvoiceRepository(this.databaseProvider);
  public readonly supplierLedgerRepository = new SupplierLedgerRepository(this.databaseProvider);
  public readonly supplierPaymentRepository = new SupplierPaymentRepository(this.databaseProvider);
  public readonly supplierReportRepository = new SupplierReportRepository(this.databaseProvider);

  // Services (Lazy loaded to resolve circular dependencies/ordering)
  private _authService: any = null;
  private _invoiceService: any = null;
  private _inventoryService: any = null;
  private _reportsService: any = null;
  private _supplierService: any = null;
  private _procurementService: any = null;
  private _supplierLedgerService: any = null;
  private _procurementReportsService: any = null;

  public get authService() {
    if (!this._authService) {
      const { AuthService } = require('../../modules/auth/backend/service/auth_service');
      this._authService = new AuthService(this.userRepository);
    }
    return this._authService;
  }

  public get invoiceService() {
    if (!this._invoiceService) {
      const { InvoiceService } = require('../../modules/billing/backend/service/invoice_service');
      this._invoiceService = new InvoiceService(
        this.invoiceRepository,
        this.productRepository,
        this.inventoryRepository,
        this.settingsRepository,
        this.cashRepository
      );
    }
    return this._invoiceService;
  }

  public get inventoryService() {
    if (!this._inventoryService) {
      const { InventoryService } = require('../../modules/inventory/backend/service/inventory_service');
      this._inventoryService = new InventoryService(
        this.inventoryRepository,
        this.supplierRepository,
        this.purchaseRepository,
        this.userRepository
      );
    }
    return this._inventoryService;
  }

  public get reportsService() {
    if (!this._reportsService) {
      const { ReportsService } = require('../../modules/reports/backend/service/reports_service');
      this._reportsService = new ReportsService(
        this.invoiceRepository,
        this.purchaseRepository
      );
    }
    return this._reportsService;
  }

  public get supplierService() {
    if (!this._supplierService) {
      const { supplierService } = require('../../modules/inventory/backend/service/supplier_service');
      this._supplierService = supplierService;
    }
    return this._supplierService;
  }

  public get procurementService() {
    if (!this._procurementService) {
      const { procurementService } = require('../../modules/inventory/backend/service/procurement_service');
      this._procurementService = procurementService;
    }
    return this._procurementService;
  }

  public get supplierLedgerService() {
    if (!this._supplierLedgerService) {
      const { supplierLedgerService } = require('../../modules/inventory/backend/service/supplier_ledger_service');
      this._supplierLedgerService = supplierLedgerService;
    }
    return this._supplierLedgerService;
  }

  public get procurementReportsService() {
    if (!this._procurementReportsService) {
      const { procurementReportsService } = require('../../modules/inventory/backend/service/procurement_reports_service');
      this._procurementReportsService = procurementReportsService;
    }
    return this._procurementReportsService;
  }

  public get deliveryService() {
    const { deliveryService } = require('../../modules/delivery/backend/service/delivery_service');
    return deliveryService;
  }

  public get addressService() {
    const { addressService } = require('../../modules/delivery/backend/service/address_service');
    return addressService;
  }
}

export const container = new ServiceContainer();
export default container;
