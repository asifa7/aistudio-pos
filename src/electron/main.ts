import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../core/backend/logger';
import { configManager, config } from '../core/backend/config';
import { db } from '../core/backend/db';
import { migrationEngine } from '../core/backend/migrations';
import { IPC_CHANNELS } from '../core/ipc/channels';
import { handleIPCRequest } from '../core/backend/errors';
import { checkIPCPermission } from '../core/ipc/ipc_permissions';
import { container } from '../core/di/container';
import { productsRepository } from '../modules/billing/backend/repository/products_repository';
import { pricingService } from '../modules/billing/backend/service/pricing_service';
import { invoiceService } from '../modules/billing/backend/service/invoice_service';
import { invoiceRepository } from '../modules/billing/backend/repository/invoice_repository';
import { inventoryService } from '../modules/inventory/backend/service/inventory_service';
import { productManagementService } from '../modules/products/backend/service/product_management_service';
import { authService } from '../modules/auth/backend/service/auth_service';
import { reportsService } from '../modules/reports/backend/service/reports_service';
import { backupService } from '../core/backend/backup_service';
import { receiptService } from '../modules/billing/backend/service/receipt_service';
import { customerService } from '../modules/customers/backend/service/customer_service';
import { creditService } from '../modules/customers/backend/service/credit_service';
import { arReportsService } from '../modules/customers/backend/service/ar_reports_service';
import { supplierService } from '../modules/inventory/backend/service/supplier_service';
import { procurementService } from '../modules/inventory/backend/service/procurement_service';
import { supplierLedgerService } from '../modules/inventory/backend/service/supplier_ledger_service';
import { procurementReportsService } from '../modules/inventory/backend/service/procurement_reports_service';
import { stockBatchRepository } from '../modules/inventory/backend/repository/stock_batch_repository';
import { yieldProcessingService } from '../modules/inventory/backend/service/yield_processing_service';
import { hrService } from '../modules/hr/backend/service/hr_service';
import { cashBoxService } from '../modules/cashbox/backend/service/cashbox_service';
import { expenseService } from '../modules/expenses/backend/service/expense_service';
import { marketPriceService } from '../modules/pricing/backend/service/market_price_service';
import { ledgerService } from '../modules/ledger/backend/service/ledger_service';
import { stockTransferService } from '../modules/inventory/backend/service/stock_transfer_service';
import { demandForecastingService } from '../modules/inventory/backend/service/demand_forecasting_service';
import { branchService } from '../modules/inventory/backend/service/branch_service';
import { assetService } from '../modules/inventory/backend/service/asset_service';
import { inventoryLedgerService } from '../modules/inventory/backend/service/inventory_ledger_service';
import { paymentEngineService } from '../modules/ledger/backend/service/payment_engine_service';


let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Prevent multiple instances of the app from running simultaneously.
// Without this, clicking the app icon again while a previous launch is
// still starting up (or stuck) spawns a second process that competes for
// the same SQLite database file, compounding startup delay instead of
// helping. Every extra click makes it worse, not better.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  logger.info('Another instance of the app is already running. Quitting this instance.');
  app.quit();
} else {
  app.on('second-instance', () => {
    logger.info('Second instance attempted to launch — focusing existing window instead.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (splashWindow) {
      splashWindow.focus();
    }
  });
}

async function loadURLWithRetry(
  targetWindow: BrowserWindow,
  url: string,
  maxRetries = 30,
  delayMs = 500
): Promise<void> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      if (targetWindow.isDestroyed()) return;
      await targetWindow.loadURL(url);
      logger.info(`Successfully loaded URL: ${url} (attempt ${attempt + 1})`);
      return;
    } catch (err: any) {
      attempt++;
      logger.warn(`Dev server load attempt ${attempt}/${maxRetries} failed for ${url} (${err.message || err}). Retrying in ${delayMs}ms...`);
      if (attempt >= maxRetries) {
        logger.error(`Failed to load URL ${url} after ${maxRetries} attempts`, err);
        if (!targetWindow.isDestroyed()) {
          const errorHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { background: #090d16; color: #f87171; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                  .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                  h2 { color: #ef4444; margin-top: 0; }
                  p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
                  code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h2>Dev Server Connection Failed</h2>
                  <p>Could not connect to Vite dev server at <code>${url}</code> after ${maxRetries} retries.</p>
                  <p>Please ensure Vite is running on port 3000 and try starting the app again.</p>
                </div>
              </body>
            </html>
          `;
          await targetWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
        }
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

async function createSplashWindow() {
  logger.info('Creating splash screen window...');
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    useContentSize: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    try {
      await loadURLWithRetry(splashWindow, `${DEV_SERVER_URL}/splash.html`, 30, 500);
    } catch (e) {
      logger.warn('Splash window failed to load dev URL', { error: e });
    }
  } else {
    await splashWindow.loadFile(path.join(app.getAppPath(), 'dist/splash.html'));
  }
}

async function createMainWindow() {
  logger.info('Creating main application window...');
  mainWindow = new BrowserWindow({
    title: 'Meat Shop POS',
    width: 1600,
    height: 800,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    center: true,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#090d16',
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    movable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logger.info(`[CONSOLE_LOG] [Level: ${level}] ${message} (at ${sourceId}:${line})`);
  });

  // Track load failures explicitly - loadURL/loadFile rejecting (slow dev
  // server, wrong path, network hiccup) must never leave the splash screen
  // stuck on screen forever with an invisible, unusable main window behind it.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('Main window failed to load content', undefined, { errorCode, errorDescription, validatedURL });
  });

  try {
    if (isDev) {
      await loadURLWithRetry(mainWindow, DEV_SERVER_URL, 30, 500);
      if (process.env.OPEN_DEVTOOLS === '1' && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    } else {
      await mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
  } catch (err) {
    logger.error('CRITICAL: Main window failed to load after retries - will still force the window visible below so the app is never stuck invisible behind a frozen splash screen', err);
    // Fall through deliberately: reveal whatever state the window is in
    // (even a blank/error page) rather than leaving the user staring at
    // a stuck, frameless splash screen with no way to close or resize it.
  }

  const revealMainWindow = () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.maximize();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
      logger.info('Main window displayed maximized with window control buttons (Minimize, Maximize, Close), splash screen closed.');
    }
  };

  mainWindow.once('ready-to-show', revealMainWindow);

  // Safety net: if 'ready-to-show' never fires for any reason, force the
  // window visible after a short grace period instead of leaving the splash
  // on screen indefinitely with no way for the user to even close the app.
  setTimeout(revealMainWindow, 8000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// All renderer-to-main calls pass through one permission gate.
// Keeping this at the IPC boundary prevents a caller from bypassing UI-level
// role checks by invoking an exposed channel directly.
function secureIpcHandle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
): void {
  secureIpcHandleRaw(channel, handler);
}

function secureIpcHandleRaw(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      checkIPCPermission(channel);
      return await handler(event, ...args);
    } catch (error) {
      return handleIPCRequest(() => { throw error; });
    }
  });
}

// Register IPC handlers
function registerIpcHandlers() {
  logger.info('Registering IPC handlers...');

  // Configuration Handlers
  secureIpcHandle(IPC_CHANNELS.CONFIG.GET, () => {
    return handleIPCRequest(() => configManager.get());
  });

  secureIpcHandle(IPC_CHANNELS.CONFIG.UPDATE, (_, newConfig) => {
    return handleIPCRequest(() => configManager.update(newConfig));
  });

  // Database Handlers
  secureIpcHandle(IPC_CHANNELS.DATABASE.HEALTH, () => {
    return handleIPCRequest(() => {
      const result = db.prepare('SELECT 1 as active').get() as { active: number };
      const migrationCount = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number };
      return {
        status: result?.active === 1 ? 'OK' : 'ERROR',
        appliedMigrations: migrationCount?.count || 0,
      };
    });
  });

  // System Handlers
  secureIpcHandle(IPC_CHANNELS.SYSTEM.GET_INFO, () => {
    return handleIPCRequest(() => ({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      env: config.env,
      dbPath: config.dbPath,
    }));
  });

  secureIpcHandle(IPC_CHANNELS.SYSTEM.LOG, (_, { level, message, meta }) => {
    return handleIPCRequest(() => {
      switch (level) {
        case 'DEBUG':
          logger.debug(`[Renderer] ${message}`, meta);
          break;
        case 'WARN':
          logger.warn(`[Renderer] ${message}`, meta);
          break;
        case 'ERROR':
          logger.error(`[Renderer] ${message}`, undefined, meta);
          break;
        case 'INFO':
        default:
          logger.info(`[Renderer] ${message}`, meta);
          break;
      }
      return true;
    });
  });

  // ─── Billing Handlers ───

  secureIpcHandle(IPC_CHANNELS.BILLING.GET_PRODUCTS, () => {
    return handleIPCRequest(() => productsRepository.findAll());
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.GET_VARIANTS, () => {
    return handleIPCRequest(() => pricingService.getActiveVariants());
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.UPDATE_RATE, (_, args) => {
    return handleIPCRequest(() => pricingService.updateVariantRate(args.variant_id, args.new_rate_paise_per_unit, args.set_by));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.CREATE_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.createDraft(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.GET_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.getInvoice(args.invoice_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.ADD_ITEM, (_, args) => {
    return handleIPCRequest(() => invoiceService.addItem(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.UPDATE_ITEM_QTY, (_, args) => {
    return handleIPCRequest(() => invoiceService.updateItemQuantity(args.item_id, args.quantity_grams, args.quantity_units));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.REMOVE_ITEM, (_, args) => {
    return handleIPCRequest(() => invoiceService.removeItem(args.item_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.HOLD_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.holdInvoice(args.invoice_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.RESUME_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.resumeInvoice(args.invoice_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.REOPEN_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.reopenCompletedInvoice(args.invoice_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.COMPLETE_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.completeInvoice(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.VOID_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.voidInvoice(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.RETURN_INVOICE, (_, args) => {
    return handleIPCRequest(() => invoiceService.returnInvoice(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.TOGGLE_GST, (_, args) => {
    return handleIPCRequest(() => invoiceService.toggleGst(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.RECORD_PAYMENT, (_, args) => {
    return handleIPCRequest(() => invoiceService.recordPayment(args));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.LIST_HELD, () => {
    return handleIPCRequest(() => invoiceService.listHeld());
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.DELETE_DRAFT, (_, args) => {
    return handleIPCRequest(() => invoiceService.deleteDraft(args.invoice_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.LINK_CUSTOMER, (_, args: { invoice_id: number; customer_id: number | null }) => {
    return handleIPCRequest(() => invoiceService.linkCustomer(args.invoice_id, args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.BILLING.SEARCH_INVOICES, (_, filter: any) => {
    return handleIPCRequest(() => invoiceRepository.searchInvoices(filter));
  });

  async function printThermalHTMLWindow(htmlContent: string): Promise<{ success: boolean; failureReason?: string }> {
    return new Promise((resolve) => {
      const currentConfig = (configManager.get() as any);
      const paperWidth = currentConfig.receiptTemplate?.paperWidth || '80mm';
      const is58 = paperWidth === '58mm';
      const widthMicrons = is58 ? 58000 : 80000;
      const targetWidthPx = is58 ? 219 : 302;

      let printWindow = new BrowserWindow({
        width: targetWidthPx,
        height: 1000,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWindow.webContents.on('did-finish-load', async () => {
        try {
          let printerName = currentConfig.hardware?.printerName;

          if (!printerName) {
            try {
              const printers = await printWindow.webContents.getPrintersAsync();
              const rpPrinter = printers.find(p => p.name.toLowerCase().includes('rp 3220') || p.name.toLowerCase().includes('star'));
              const defaultPrinter = printers.find(p => p.isDefault);

              if (rpPrinter) {
                printerName = rpPrinter.name;
              } else if (defaultPrinter) {
                printerName = defaultPrinter.name;
              }

              if (printerName) {
                configManager.update({
                  hardware: {
                    ...(currentConfig.hardware || {}),
                    printerName
                  }
                } as any);
              }
            } catch (pErr) {
              logger.warn('Could not enumerate system printers', { error: pErr });
            }
          }

          // Measure dynamic height of rendered thermal receipt container in pixels
          const heightPx = await printWindow.webContents.executeJavaScript(`
            (() => {
              const container = document.querySelector('.receipt-container') || document.body;
              return Math.ceil(Math.max(
                container.getBoundingClientRect().height,
                container.scrollHeight,
                document.body.scrollHeight,
                document.documentElement.offsetHeight
              ));
            })()
          `);

          // Convert CSS pixels to microns (96 dpi: 1px ≈ 264.5833 microns)
          // Add 3mm (3,000 microns) margin for paper tear/cutter
          const heightMicrons = Math.max(20000, Math.ceil(heightPx * 264.5833) + 3000);

          const printOptions: any = {
            silent: true, // Always true to NEVER show print dialog box!
            printBackground: true,
            margins: { marginType: 'none' },
            scaleFactor: 100,
            color: false,
            landscape: false,
            headerFooterEnabled: false,
            pageSize: { width: widthMicrons, height: heightMicrons },
            dpi: { horizontal: 203, vertical: 203 }
          };

          if (printerName) {
            printOptions.deviceName = printerName;
          }

          printWindow.webContents.print(printOptions, (success, failureReason) => {
            logger.info('Thermal print job processed', { success, failureReason, paperWidth, printerName, heightMicrons, heightPx });
            printWindow.destroy();
            resolve({ success, failureReason });
          });
        } catch (err: any) {
          logger.error('Failed executing thermal print', { error: err });
          printWindow.destroy();
          resolve({ success: false, failureReason: err.message });
        }
      });
    });
  }

  secureIpcHandle(IPC_CHANNELS.BILLING.PRINT_RECEIPT, async (_, args: { invoice_id: number; previewOnly?: boolean }) => {
    return handleIPCRequest(async () => {
      const receiptText = receiptService.generateReceiptText(args.invoice_id);

      if (args.previewOnly) {
        return { success: true, receiptText };
      }

      const htmlContent = receiptService.generateReceiptHTML(args.invoice_id);
      const printResult = await printThermalHTMLWindow(htmlContent);

      return { success: printResult.success, receiptText, failureReason: printResult.failureReason };
    });
  });

  // ─── Inventory Handlers ───
  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_STOCK, () => {
    return handleIPCRequest(() => inventoryService.getStockStatus());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_INDICATORS, () => {
    return handleIPCRequest(() => inventoryService.getIndicators());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.ADJUST_STOCK, (_, args) => {
    return handleIPCRequest(() => inventoryService.adjustStock(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_LOW_STOCK, () => {
    return handleIPCRequest(() => inventoryService.getLowStockAlerts());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_TXN_HISTORY, (_, args) => {
    return handleIPCRequest(() => inventoryService.getTransactionHistory(args?.limit));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_ADJ_HISTORY, (_, args) => {
    return handleIPCRequest(() => inventoryService.getAdjustmentsHistory(args?.limit));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.PROCESS_PENDING, () => {
    return handleIPCRequest(() => inventoryService.processPendingEvents());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_SUPPLIERS, () => {
    return handleIPCRequest(() => inventoryService.listSuppliers());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CREATE_SUPPLIER, (_, args) => {
    return handleIPCRequest(() => inventoryService.createSupplier(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.RECORD_PURCHASE, (_, args) => {
    return handleIPCRequest(() => inventoryService.recordPurchase(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.RECORD_QUICK_PURCHASE, async (_, args) => {
    return handleIPCRequest(async () => {
      let finalPhotoPath: string | null = null;
      if (args.bill_photo_path) {
        try {
          const ext = path.extname(args.bill_photo_path);
          const newFileName = `bill_${Date.now()}${ext}`;
          const billsDir = path.join(app.getPath('userData'), 'documents', 'bills');
          if (!fs.existsSync(billsDir)) {
            fs.mkdirSync(billsDir, { recursive: true });
          }
          finalPhotoPath = path.join(billsDir, newFileName);
          fs.copyFileSync(args.bill_photo_path, finalPhotoPath);
        } catch (e) {
          logger.error('Failed to copy bill photo', e as Error);
          throw new Error('Failed to save bill photo file');
        }
      }
      const updatedArgs = { ...args, bill_photo_path: finalPhotoPath };
      return container.procurementService.recordQuickPurchase(updatedArgs, authService.getCurrentUserId() || 1);
    });
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_NEXT_PURCHASE_REF, (_, args?: { receivedDate?: string }) => {
    return handleIPCRequest(() => container.procurementService.getNextPurchaseRefNumber(args?.receivedDate));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_PURCHASES, () => {
    return handleIPCRequest(() => inventoryService.listPurchases());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_PASSBOOK_LEDGER, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getPassbookLedger(args || {}));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_SUPPLIER_SNAPSHOT, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getSupplierSnapshot(args.supplier_id));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.EDIT_PURCHASE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.editPurchaseRecord(
      args.invoice_id, 
      args.update_data, 
      authService.getCurrentUserId() || 1, 
      args.reason
    ));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.PRINT_PURCHASE_THERMAL, async (_, args: { invoice_id: number; previewOnly?: boolean }) => {
    return handleIPCRequest(async () => {
      const receiptText = receiptService.generatePurchaseThermalText(args.invoice_id);

      if (args.previewOnly) {
        return { success: true, receiptText };
      }

      const htmlContent = receiptService.generatePurchaseThermalHTML(args.invoice_id);
      const printResult = await printThermalHTMLWindow(htmlContent);

      return { success: printResult.success, receiptText, failureReason: printResult.failureReason };
    });
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.SUBMIT_PHYSICAL_COUNT, (_, args: { counts: Array<{ product_variant_id: number; counted_quantity: number }> }) => {
    return handleIPCRequest(() => container.inventoryService.submitPhysicalStockCount(args.counts));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_LAST_PHYSICAL_COUNT, () => {
    return handleIPCRequest(() => container.inventoryService.getLastPhysicalCountAt());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_SIDEBAR_SUMMARY, () => {
    return handleIPCRequest(() => container.inventoryService.getSidebarSummary());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_BATCHES, (_, args: { product_variant_id: number }) => {
    return handleIPCRequest(() => stockBatchRepository.getAllBatchesForVariant(args.product_variant_id));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.EXECUTE_YIELD, (_, args: any) => {
    return handleIPCRequest(() => yieldProcessingService.executeYieldProcessing(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_YIELD_RUNS, () => {
    return handleIPCRequest(() => yieldProcessingService.listYieldRuns());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LOG_LIVESTOCK_LOSS, (_, args: any) => {
    return handleIPCRequest(() => container.inventoryService.logLivestockLoss(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_LOCATIONS, () => {
    return handleIPCRequest(() => stockTransferService.getLocations());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.INITIATE_TRANSFER, (_, args: any) => {
    return handleIPCRequest(() => stockTransferService.initiateTransfer(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CONFIRM_TRANSFER_RECEIPT, (_, args: any) => {
    return handleIPCRequest(() => stockTransferService.confirmTransferReceipt(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_TRANSFERS, (_, args?: { status?: string }) => {
    return handleIPCRequest(() => stockTransferService.listTransfers(args?.status));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.BULK_IMPORT_PRODUCTS, (_, args: { rows: any[] }) => {
    return handleIPCRequest(() => productManagementService.bulkImportProducts(args.rows));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_VALUATION_REPORT, (_, args?: any) => {
    return handleIPCRequest(() => inventoryService.getStockValuationReport(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_MOVEMENT_REPORT, (_, args: any) => {
    return handleIPCRequest(() => inventoryService.getStockMovementReport(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_WASTAGE_REPORT, (_, args: any) => {
    return handleIPCRequest(() => inventoryService.getWastageLossReport(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_COGS_REPORT, (_, args: any) => {
    return handleIPCRequest(() => inventoryService.getCOGSReport(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_ITEM_ANALYTICS, (_, args: { variantId: number }) => {
    return handleIPCRequest(() => demandForecastingService.getItemSalesAnalytics(args.variantId));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_PURCHASING_SUGGESTIONS, () => {
    return handleIPCRequest(() => demandForecastingService.getPurchasingSuggestions());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_UPCOMING_EVENTS, (_, args?: { daysAhead?: number }) => {
    return handleIPCRequest(() => demandForecastingService.getUpcomingEvents(args?.daysAhead));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.LIST_CALENDAR_EVENTS, () => {
    return handleIPCRequest(() => demandForecastingService.listAllCalendarEvents());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CREATE_CALENDAR_EVENT, (_, args: any) => {
    return handleIPCRequest(() => demandForecastingService.createCalendarEvent(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.DELETE_CALENDAR_EVENT, (_, args: { id: number }) => {
    return handleIPCRequest(() => demandForecastingService.deleteCalendarEvent(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_PENDING_BULK_ORDERS, () => {
    return handleIPCRequest(() => demandForecastingService.getPendingBulkOrders());
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CREATE_BULK_ORDER, (event, args: any) => {
    const userId = (event as any).sender?.sessionUserId || 1;
    return handleIPCRequest(() => demandForecastingService.createBulkOrder(args, userId));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CANCEL_BULK_ORDER, (event, args: { id: number }) => {
    const userId = (event as any).sender?.sessionUserId || 1;
    return handleIPCRequest(() => demandForecastingService.cancelBulkOrder(args.id, userId));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.CORRECT_BATCH, (_, args: { batch_id: number; reason: string }) => {
    return handleIPCRequest(() => inventoryService.correctStockBatch(args));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_REFRIGERATOR_STOCK, (_, args?: { branchId?: number }) => {
    return handleIPCRequest(() => inventoryService.getRefrigeratorStock(args?.branchId || 1));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.RECORD_FRIDGE_REMOVAL, (_, args: any) => {
    return handleIPCRequest(() => inventoryService.recordFridgeRemoval({
      ...args,
      user_id: authService.getCurrentUserId() || 1,
    }));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.RECORD_FRIDGE_ADDITION, (_, args: any) => {
    return handleIPCRequest(() => inventoryService.recordFridgeAddition({
      ...args,
      user_id: authService.getCurrentUserId() || 1,
    }));
  });

  secureIpcHandle(IPC_CHANNELS.INVENTORY.GET_FRIDGE_ACTIVITY_LOG, (_, args?: { branchId?: number; limit?: number }) => {
    return handleIPCRequest(() => inventoryService.getFridgeActivityLog(args));
  });

  // ─── Authentication Handlers ───
  secureIpcHandle(IPC_CHANNELS.AUTH.LOGIN, (_, args) => {
    return handleIPCRequest(() => authService.login(args.username, args.password));
  });

  secureIpcHandle(IPC_CHANNELS.AUTH.LOGOUT, () => {
    return handleIPCRequest(() => authService.logout());
  });

  secureIpcHandle(IPC_CHANNELS.AUTH.GET_SESSION, () => {
    return handleIPCRequest(() => authService.getSession());
  });

  secureIpcHandle(IPC_CHANNELS.AUTH.VERIFY_PASSWORD, (_, args) => {
    return handleIPCRequest(() => authService.verifyCurrentUserPassword(args.password));
  });

  // ─── Reports Handlers ───
  secureIpcHandle(IPC_CHANNELS.REPORTS.GET_SALES_SUMMARY, (_, args) => {
    return handleIPCRequest(() => reportsService.getSalesSummary(args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.REPORTS.GET_CATEGORY_SALES, (_, args) => {
    return handleIPCRequest(() => reportsService.getCategorySales(args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.REPORTS.GET_PROFIT_SUMMARY, (_, args) => {
    return handleIPCRequest(() => reportsService.getProfitSummary(args.startDate, args.endDate));
  });

  // ─── Products Management Handlers ───

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.GET_ALL, () => {
    return handleIPCRequest(() => productManagementService.getAllProducts());
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.CREATE, (_, args) => {
    return handleIPCRequest(() => productManagementService.createProduct(args));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.UPDATE, (_, args) => {
    return handleIPCRequest(() => productManagementService.updateProduct(args.id, args.fields));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.DEACTIVATE, (_, args) => {
    return handleIPCRequest(() => productManagementService.deactivateProduct(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.REACTIVATE, (_, args) => {
    return handleIPCRequest(() => productManagementService.reactivateProduct(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.DELETE, (_, args) => {
    return handleIPCRequest(() => productManagementService.deleteProduct(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.CREATE_VARIANT, (_, args) => {
    return handleIPCRequest(() => productManagementService.createVariant(args, args.set_by || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.UPDATE_VARIANT_NAME, (_, args) => {
    return handleIPCRequest(() => productManagementService.updateVariantName(args.variant_id, { variant_name: args.variant_name }));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.DEACTIVATE_VARIANT, (_, args) => {
    return handleIPCRequest(() => productManagementService.deactivateVariant(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.REACTIVATE_VARIANT, (_, args) => {
    return handleIPCRequest(() => productManagementService.reactivateVariant(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.DELETE_VARIANT, (_, args) => {
    return handleIPCRequest(() => productManagementService.deleteVariant(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.UPDATE_RATE, (_, args) => {
    return handleIPCRequest(() => productManagementService.updateVariantRate(args));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.UPDATE_VARIANT_YIELD, (_, args) => {
    return handleIPCRequest(() => productManagementService.updateVariantYield(args.variant_id, args.parent_variant_id, args.yield_ratio));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.UPDATE_TRACKING_MODE, (_, args: { id: number; trackInInventory: boolean; reason: string }) => {
    return handleIPCRequest(() => productManagementService.updateProductTracking(args.id, args.trackInInventory, args.reason, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.GET_TRACKING_HISTORY, (_, args: { productId: number }) => {
    return handleIPCRequest(() => productManagementService.getProductTrackingHistory(args.productId));
  });

  secureIpcHandle(IPC_CHANNELS.PRODUCTS.GET_RATE_HISTORY, (_, args) => {
    return handleIPCRequest(() => productManagementService.getRateHistory(args.variant_id));
  });

  // ─── System Backup & Export Handlers ───
  secureIpcHandle(IPC_CHANNELS.SYSTEM.BACKUP_DATABASE, async () => {
    return handleIPCRequest(async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Select Backup Destination Folder',
        properties: ['openDirectory', 'createDirectory']
      });
      const customPath = result.canceled ? undefined : result.filePaths[0];
      const backupPath = await backupService.backupDatabase(customPath);
      return { success: true, backupPath };
    });
  });

  secureIpcHandle(IPC_CHANNELS.SYSTEM.EXPORT_CSV, async (_, args: { type: 'invoices' | 'ledger' }) => {
    return handleIPCRequest(async () => {
      const defaultFilename = args.type === 'invoices' ? 'invoices-export.csv' : 'stock-ledger-export.csv';
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: `Export ${args.type === 'invoices' ? 'Invoices' : 'Stock Ledger'} to CSV`,
        defaultPath: defaultFilename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });
      if (result.canceled || !result.filePath) {
        return { success: false, reason: 'cancelled' };
      }
      backupService.exportToCSV(args.type, result.filePath);
      return { success: true, filePath: result.filePath };
    });
  });

  // ─── Customer A/R Handlers ───

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_ALL, (_, args) => {
    return handleIPCRequest(() => customerService.getAllCustomers(args?.includeInactive ?? false));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => customerService.getCustomerById(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.SEARCH, (_, args) => {
    return handleIPCRequest(() => customerService.searchCustomers(args.query, args.limit));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.CREATE, (_, args) => {
    return handleIPCRequest(() => customerService.createCustomer(args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.UPDATE, (_, args) => {
    return handleIPCRequest(() => customerService.updateCustomer(args.id, args.fields));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.DEACTIVATE, (_, args) => {
    return handleIPCRequest(() => customerService.deactivateCustomer(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.REACTIVATE, (_, args) => {
    return handleIPCRequest(() => customerService.reactivateCustomer(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_GROUPS, () => {
    return handleIPCRequest(() => customerService.getCustomerGroups());
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_ACTIVITY_LOG, (_, args) => {
    return handleIPCRequest(() => customerService.getActivityLog(args.customer_id, args.limit));
  });

  // Credit Account
  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_ACCOUNT, (_, args) => {
    return handleIPCRequest(() => creditService.getCreditAccount(args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.UPDATE_CREDIT_LIMIT, (_, args) => {
    return handleIPCRequest(() => creditService.updateCreditAccount(args.customer_id, args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.FREEZE_CREDIT, (_, args) => {
    return handleIPCRequest(() => creditService.freezeCredit(args.customer_id, args.reason));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.UNFREEZE_CREDIT, (_, args) => {
    return handleIPCRequest(() => creditService.unfreezeCredit(args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.BLACKLIST, (_, args) => {
    return handleIPCRequest(() => creditService.blacklist(args.customer_id, args.reason));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.UNBLACKLIST, (_, args) => {
    return handleIPCRequest(() => creditService.unblacklist(args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.VALIDATE_CREDIT_SALE, (_, args) => {
    return handleIPCRequest(() => creditService.validateCreditSale(args.customer_id, args.amount_paise, authService.getCurrentUserId()));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.CREATE_CREDIT_SALE, (_, args) => {
    return handleIPCRequest(() => creditService.createCreditSale(args.invoice_id, args.customer_id, args.amount_paise, args.invoice_number ?? ''));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.RECORD_PAYMENT, (_, args) => {
    return handleIPCRequest(() => creditService.recordPayment(args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.DEPOSIT_ADVANCE, (_, args) => {
    return handleIPCRequest(() => creditService.depositAdvance(args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.APPLY_ADVANCE, (_, args) => {
    return handleIPCRequest(() => creditService.applyAdvanceToInvoice(args.customer_id, args.invoice_id, args.amount_paise));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.WRITE_OFF, (_, args) => {
    return handleIPCRequest(() => creditService.writeOff(args.customer_id, args.amount_paise, args.reason));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.CREATE_CREDIT_NOTE, (_, args) => {
    return handleIPCRequest(() => creditService.createCreditNote(args.customer_id, args.original_invoice_id ?? null, args.amount_paise, args.reason));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_NOTES, (_, args) => {
    return handleIPCRequest(() => creditService.getUnappliedCreditNotes(args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_UNPAID_INVOICES, (_, args) => {
    return handleIPCRequest(() => creditService.getUnpaidInvoicesForCustomer(args.customer_id));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_TRANSACTIONS, (_, args) => {
    return handleIPCRequest(() => creditService.getCreditTransactions(args.customer_id, args.limit));
  });

  // Ledger
  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_LEDGER, (_, args) => {
    return handleIPCRequest(() => arReportsService.getCustomerLedger(args.customer_id, args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_STATEMENT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getCustomerStatement(args.customer_id, args.startDate, args.endDate));
  });

  // Reminders
  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.CREATE_REMINDER, (_, args) => {
    return handleIPCRequest(() => customerService.createReminder(args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_REMINDERS, (_, args) => {
    return handleIPCRequest(() => customerService.getReminders(args.customer_id));
  });

  // A/R Reports
  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_AGING_REPORT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getAgingReport(args?.asOfDate));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_OUTSTANDING_REPORT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getOutstandingReport(args));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_COLLECTION_REPORT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getCollectionReport(args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_ADVANCE_REPORT, () => {
    return handleIPCRequest(() => arReportsService.getAdvanceBalanceReport());
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_OVERDUE_REPORT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getOverdueReport(args?.asOfDate));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_TOP_DEBTORS, (_, args) => {
    return handleIPCRequest(() => arReportsService.getTopDebtors(args?.limit ?? 10));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_STATEMENT_REPORT, (_, args) => {
    return handleIPCRequest(() => arReportsService.getCustomerStatement(args.customer_id, args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_UTILIZATION, () => {
    return handleIPCRequest(() => arReportsService.getCreditLimitUtilization());
  });

  // ─── Suppliers IPC Handlers ───
  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.CREATE, (_, args) => {
    return handleIPCRequest(() => container.supplierService.createSupplier(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.UPDATE, (_, args) => {
    return handleIPCRequest(() => container.supplierService.updateSupplier(args.id, args.fields, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_ALL, () => {
    return handleIPCRequest(() => container.supplierService.listSuppliers());
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => container.supplierService.getSupplier(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.CREATE_CATEGORY, (_, args) => {
    return handleIPCRequest(() => container.supplierService.createCategory(args.name, args.description));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_CATEGORIES, () => {
    return handleIPCRequest(() => container.supplierService.listCategories());
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.ADD_CONTACT, (_, args) => {
    return handleIPCRequest(() => container.supplierService.addContact(args.supplierId, args.contact));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_CONTACTS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.getContacts(args.supplierId));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.REMOVE_CONTACT, (_, args) => {
    return handleIPCRequest(() => container.supplierService.removeContact(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.ADD_ADDRESS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.addAddress(args.supplierId, args.address));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_ADDRESSES, (_, args) => {
    return handleIPCRequest(() => container.supplierService.getAddresses(args.supplierId));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.REMOVE_ADDRESS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.removeAddress(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.ADD_BANK_ACCOUNT, (_, args) => {
    return handleIPCRequest(() => container.supplierService.addBankAccount(args.supplierId, args.account));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_BANK_ACCOUNTS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.getBankAccounts(args.supplierId));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.REMOVE_BANK_ACCOUNT, (_, args) => {
    return handleIPCRequest(() => container.supplierService.removeBankAccount(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.UPSERT_PAYMENT_TERMS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.upsertPaymentTerms(args.supplierId, args.terms));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_PAYMENT_TERMS, (_, args) => {
    return handleIPCRequest(() => container.supplierService.getPaymentTerms(args.supplierId));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.RATE, (_, args) => {
    return handleIPCRequest(() => container.supplierService.rateSupplier(args.supplierId, args.rating, authService.getCurrentUserId() || 1, args.comments));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.RECORD_PAYMENT, (_, args) => {
    return handleIPCRequest(() => container.supplierLedgerService.recordPayment(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.RECORD_ADJUSTMENT, (_, args) => {
    return handleIPCRequest(() => container.supplierLedgerService.recordLedgerAdjustment(args.supplierId, args.amountPaise, args.type, args.description, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_LEDGER, (_, args) => {
    return handleIPCRequest(() => container.supplierLedgerService.getLedger(args.supplierId));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_STATEMENT, (_, args) => {
    return handleIPCRequest(() => container.supplierLedgerService.getStatement(args.supplierId, args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_AGING_REPORT, () => {
    return handleIPCRequest(() => container.procurementReportsService.getSupplierAgingReport());
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_STATEMENT_REPORT, (_, args) => {
    return handleIPCRequest(() => container.procurementReportsService.getSupplierStatement(args.supplierId, args.startDate, args.endDate));
  });

  secureIpcHandle(IPC_CHANNELS.SUPPLIERS.GET_PURCHASE_VOLUMES, (_, args) => {
    return handleIPCRequest(() => container.procurementReportsService.getSupplierPurchaseVolumes(args.startDate, args.endDate));
  });

  // ─── Procurement IPC Handlers ───
  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_CREATE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.createPurchaseOrder(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_SUBMIT, (_, args) => {
    return handleIPCRequest(() => container.procurementService.submitPurchaseOrder(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_APPROVE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.approvePurchaseOrder(args.id, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_CANCEL, (_, args) => {
    return handleIPCRequest(() => container.procurementService.cancelPurchaseOrder(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getPurchaseOrder(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.PO_GET_ALL, () => {
    return handleIPCRequest(() => container.procurementService.listPurchaseOrders());
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GRN_CREATE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.createGoodsReceipt(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GRN_GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getGoodsReceipt(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GRN_GET_ALL, () => {
    return handleIPCRequest(() => container.procurementService.listGoodsReceipts());
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.INVOICE_CREATE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.createPurchaseInvoice(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.INVOICE_GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getPurchaseInvoice(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.INVOICE_GET_ALL, () => {
    return handleIPCRequest(() => container.procurementService.listPurchaseInvoices());
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.INVOICE_UPDATE_STATUS, (_, args) => {
    return handleIPCRequest(() => container.procurementService.updateInvoiceStatus(args.invoiceId, args.status));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.RETURN_CREATE, (_, args) => {
    return handleIPCRequest(() => container.procurementService.createPurchaseReturn(args, authService.getCurrentUserId() || 1));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.RETURN_GET_BY_ID, (_, args) => {
    return handleIPCRequest(() => container.procurementService.getPurchaseReturn(args.id));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.RETURN_GET_ALL, () => {
    return handleIPCRequest(() => container.procurementService.listPurchaseReturns());
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GET_PRICE_HISTORY, (_, args) => {
    return handleIPCRequest(() => container.procurementReportsService.getPriceHistoryTrend(args.productVariantId));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GET_CHEAPEST_SUPPLIER, (_, args) => {
    return handleIPCRequest(() => container.procurementReportsService.getCheapestSupplier(args.productVariantId));
  });

  secureIpcHandle(IPC_CHANNELS.PROCUREMENT.GET_PURCHASE_REGISTER, (_, args) => {
    return handleIPCRequest(() => container.procurementReportsService.getPurchaseRegister(args.startDate, args.endDate));
  });

  // ─── HR & Payroll ─────────────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.HR.GET_EMPLOYEES, (_, args) => handleIPCRequest(() => hrService.getAllEmployees(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_EMPLOYEE, (_, args) => handleIPCRequest(() => hrService.getEmployeeById(args.id)));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_EMPLOYEE, (_, args) => handleIPCRequest(() => hrService.createEmployee(args)));
  secureIpcHandle(IPC_CHANNELS.HR.UPDATE_EMPLOYEE, (_, args) => handleIPCRequest(() => hrService.updateEmployee(args.id, args.input)));
  secureIpcHandle(IPC_CHANNELS.HR.TOGGLE_EMPLOYEE_ACTIVE, (_, args) => handleIPCRequest(() => hrService.toggleEmployeeActive(args.id, args.isActive)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_SALARY_STRUCTURE, (_, args) => handleIPCRequest(() => hrService.getSalaryStructure(args.employeeId)));
  secureIpcHandle(IPC_CHANNELS.HR.UPDATE_SALARY_STRUCTURE, (_, args) => handleIPCRequest(() => hrService.updateSalaryStructure(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_ROLES, () => handleIPCRequest(() => hrService.getRoles()));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_ROLE, (_, args) => handleIPCRequest(() => hrService.createRole(args.name, args.description)));
  secureIpcHandle(IPC_CHANNELS.HR.CLOCK_ATTENDANCE, (_, args) => handleIPCRequest(() => hrService.markAttendance({ employee_id: args.employeeId, date: args.date || new Date().toISOString().slice(0, 10), status: args.status, notes: args.notes })));
  secureIpcHandle(IPC_CHANNELS.HR.MARK_ATTENDANCE, (_, args) => handleIPCRequest(() => hrService.markAttendance(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_ATTENDANCE, (_, args) => handleIPCRequest(() => hrService.getMonthAttendanceGrid(args?.monthYear)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_MONTH_ATTENDANCE, (_, args) => handleIPCRequest(() => hrService.getMonthAttendanceGrid(args?.monthYear)));
  secureIpcHandle(IPC_CHANNELS.HR.MARK_BULK_PRESENT_TODAY, (_, args) => handleIPCRequest(() => hrService.markBulkPresentToday(args?.date)));
  secureIpcHandle(IPC_CHANNELS.HR.IS_MONTH_LOCKED, (_, args) => handleIPCRequest(() => hrService.isMonthLocked(args.monthYear)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_LEAVE_TYPES, () => handleIPCRequest(() => hrService.getLeaveTypes()));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_LEAVE_TYPE, (_, args) => handleIPCRequest(() => hrService.createLeaveType(args)));
  secureIpcHandle(IPC_CHANNELS.HR.APPLY_LEAVE, (_, args) => handleIPCRequest(() => hrService.applyLeave(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_LEAVES, (_, args) => handleIPCRequest(() => hrService.getLeaves(args)));
  secureIpcHandle(IPC_CHANNELS.HR.APPROVE_LEAVE, (_, args) => handleIPCRequest(() => hrService.approveLeave(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_LEAVE_BALANCES, (_, args) => handleIPCRequest(() => hrService.getLeaveBalances(args?.employeeId, args?.year)));
  // Phase 2 Handlers
  secureIpcHandle(IPC_CHANNELS.HR.GET_LEDGER, (_, args) => handleIPCRequest(() => hrService.getEmployeeLedger(args.employeeId, args?.dateRange)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_ADVANCES, (_, args) => handleIPCRequest(() => hrService.getAdvances(args)));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_ADVANCE, (_, args) => handleIPCRequest(() => hrService.createAdvance(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_EXPENSES, (_, args) => handleIPCRequest(() => hrService.getExpenses(args)));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_EXPENSE, (_, args) => handleIPCRequest(() => hrService.createExpense(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_INCENTIVE_RULES, () => handleIPCRequest(() => hrService.getIncentiveRules()));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_INCENTIVE_RULE, (_, args) => handleIPCRequest(() => hrService.createIncentiveRule(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_INCENTIVES, (_, args) => handleIPCRequest(() => hrService.getIncentives(args)));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_MANUAL_INCENTIVE, (_, args) => handleIPCRequest(() => hrService.createManualIncentive(args)));
  secureIpcHandle(IPC_CHANNELS.HR.EVALUATE_RULE_INCENTIVES, (_, args) => handleIPCRequest(() => hrService.evaluateRuleIncentives(args?.monthYear ?? args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_OVERTIME_RECORDS, (_, args) => handleIPCRequest(() => hrService.getOvertimeRecords(args)));
  secureIpcHandle(IPC_CHANNELS.HR.RECORD_OVERTIME, (_, args) => handleIPCRequest(() => hrService.recordOvertime(args)));
  secureIpcHandle(IPC_CHANNELS.HR.GET_DEDUCTIONS, (_, args) => handleIPCRequest(() => hrService.getDeductions(args)));
  secureIpcHandle(IPC_CHANNELS.HR.CREATE_DEDUCTION, (_, args) => handleIPCRequest(() => hrService.createDeduction(args)));

  // ─── HR Phase 3 & 4: Payroll Engine, Flexible Periods, Statements, Slips, Payments, Audit, Reversals, Locks, Relieving, Reports ───
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_GENERATE, (_, args) => handleIPCRequest(() => hrService.generateMonthlyPayroll(args?.periodInput ?? args?.monthYear ?? args, args?.forceRecalculate)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_GET_RUN, (_, args) => handleIPCRequest(() => hrService.getPayrollRun(args?.monthYear ?? args)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_GET_ITEMS, (_, args) => handleIPCRequest(() => hrService.getPayrollItems(args?.monthYear ?? args, args?.filters)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_OVERRIDE_NET, (_, args) => handleIPCRequest(() => hrService.overridePayrollItemNet(args.itemId, args.newNetSalaryPaise, args.reason)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_APPROVE_RUN, (_, args) => handleIPCRequest(() => hrService.approvePayrollRun(args?.monthYear ?? args)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_PAY_ITEM, (_, args) => handleIPCRequest(() => hrService.payPayrollItem(args)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_REVERSE_ITEM, (_, args) => handleIPCRequest(() => hrService.reversePayrollItemPayment(args.itemId, args.reason)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_LOCK_RUN, (_, args) => handleIPCRequest(() => hrService.lockPayrollRun(args?.monthYear ?? args, args?.notes)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_REOPEN_RUN, (_, args) => handleIPCRequest(() => hrService.reopenPayrollRun(args?.monthYear ?? args, args.reason)));
  secureIpcHandle(IPC_CHANNELS.HR.PAYROLL_GET_HISTORY, (_, args) => handleIPCRequest(() => hrService.getEmployeePayrollHistory(args.employeeId)));
  secureIpcHandle(IPC_CHANNELS.HR.EMPLOYEE_GET_360, (_, args) => handleIPCRequest(() => hrService.getEmployeeSummary360(args.employeeId)));
  secureIpcHandle(IPC_CHANNELS.HR.REPORTS_PAYROLL_SUMMARY, (_, args) => handleIPCRequest(() => hrService.getPayrollSummaryReport(args?.monthYear, args?.year)));
  secureIpcHandle(IPC_CHANNELS.HR.AUDIT_LOGS_GET, (_, args) => handleIPCRequest(() => hrService.getAuditLogs(args)));
  secureIpcHandle(IPC_CHANNELS.HR.EMPLOYEE_SETTLE_RELIEVING, (_, args) => handleIPCRequest(() => hrService.settleEmployeeRelieving(args)));

  // ─── Cash Box & Shift Session ──────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.CASHBOX.OPEN_SESSION, (_, args) => handleIPCRequest(() => cashBoxService.openSession(args.openingCashPaise, args.denominations)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.CLOSE_SESSION, (_, args) => handleIPCRequest(() => cashBoxService.closeSession(args)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_CURRENT_SESSION, () => handleIPCRequest(() => cashBoxService.getCurrentSession()));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.RECORD_TRANSACTION, (_, args) => handleIPCRequest(() => cashBoxService.recordTransaction(args.type, args.amountPaise, args.category, args.reason)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.RECORD_MOVEMENT, (_, args) => handleIPCRequest(() => cashBoxService.recordMovement(args)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.UPDATE_OPEN_MOVEMENT, (_, args) => handleIPCRequest(() => cashBoxService.updateOpenMovement(args.movementId, args.input)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.DELETE_OPEN_MOVEMENT, (_, args) => handleIPCRequest(() => cashBoxService.deleteOpenMovement(args.movementId)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_TRANSACTIONS, (_, args) => handleIPCRequest(() => cashBoxService.getTransactions(args?.sessionId, args?.limit, args?.offset)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_DASHBOARD, (_, args) => handleIPCRequest(() => cashBoxService.getDashboard(args?.sessionId)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_SHIFT_HISTORY, (_, args) => handleIPCRequest(() => cashBoxService.getShiftHistory(args)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_SHIFT_DETAILS, (_, args) => handleIPCRequest(() => cashBoxService.getShiftDetails(args.sessionId)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.APPLY_CORRECTION, (_, args) => handleIPCRequest(() => cashBoxService.applyShiftCorrection(args)));
  secureIpcHandle(IPC_CHANNELS.CASHBOX.GET_SHIFT_TRANSACTIONS, (_, args) => handleIPCRequest(() => cashBoxService.getShiftTransactions(args.sessionId)));

  // ─── Expense Manager ─────────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.EXPENSES.GET_CATEGORIES, () => handleIPCRequest(() => expenseService.getCategories()));
  secureIpcHandle(IPC_CHANNELS.EXPENSES.CREATE_CATEGORY, (_, args) => handleIPCRequest(() => expenseService.createCategory(args.name)));
  secureIpcHandle(IPC_CHANNELS.EXPENSES.RECORD_EXPENSE, (_, args) => handleIPCRequest(() => expenseService.recordExpense(args)));
  secureIpcHandle(IPC_CHANNELS.EXPENSES.GET_EXPENSES, () => handleIPCRequest(() => expenseService.getExpenses()));

  // ─── Daily Market Prices ──────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.MARKET_PRICES.SET_CHICKEN_PRICE, (_, args) => handleIPCRequest(() => marketPriceService.setChickenPrice(args)));
  secureIpcHandle(IPC_CHANNELS.MARKET_PRICES.GET_CHICKEN_PRICES, () => handleIPCRequest(() => marketPriceService.getChickenPrices()));
  secureIpcHandle(IPC_CHANNELS.MARKET_PRICES.SET_EGG_PRICE, (_, args) => handleIPCRequest(() => marketPriceService.setEggPrice(args)));
  secureIpcHandle(IPC_CHANNELS.MARKET_PRICES.GET_EGG_PRICES, () => handleIPCRequest(() => marketPriceService.getEggPrices()));

  // ─── Ledgers & Audit Logs ────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.LEDGERS.GET_ENTRIES, (_, args) => handleIPCRequest(() => ledgerService.getAccountingEntries(args?.accountType)));
  secureIpcHandle(IPC_CHANNELS.AUDIT.GET_LOGS, () => handleIPCRequest(() => ledgerService.getAuditLogs()));

  // ─── Branches ────────────────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.BRANCHES.LIST, () => handleIPCRequest(() => branchService.listBranches()));
  secureIpcHandle(IPC_CHANNELS.BRANCHES.GET_ACTIVE, () => handleIPCRequest(() => branchService.getActiveBranches()));
  secureIpcHandle(IPC_CHANNELS.BRANCHES.CREATE, (_, args) => handleIPCRequest(() => branchService.createBranch(args, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.BRANCHES.UPDATE, (_, args) => handleIPCRequest(() => branchService.updateBranch(args.id, args.input, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.BRANCHES.TOGGLE_ACTIVE, (_, args) => handleIPCRequest(() => branchService.toggleActive(args.id, args.isActive, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.BRANCHES.DELETE, (_, args) => handleIPCRequest(() => branchService.deleteBranch(args.id, authService.getCurrentUserId() || 1)));

  // ─── Assets ──────────────────────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.ASSETS.LIST, (_, args) => handleIPCRequest(() => assetService.listAssets(args)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.GET, (_, args) => handleIPCRequest(() => assetService.getAsset(args.id)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.CREATE, (_, args) => handleIPCRequest(() => assetService.createAsset(args, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.UPDATE, (_, args) => handleIPCRequest(() => assetService.updateAsset(args.id, args.input, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.RECORD_REPLACEMENT, (_, args) => handleIPCRequest(() => assetService.recordReplacement(args, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.DELETE, (_, args) => handleIPCRequest(() => assetService.deleteAsset(args.id, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.ASSETS.GET_SUMMARY, (_, args) => handleIPCRequest(() => assetService.getAssetValuationSummary(args?.branchId)));

  // ─── Inventory Ledger & Stock Reports ─────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.INVENTORY_LEDGER.GET_ACTIVITY_LOG, (_, args) => handleIPCRequest(() => inventoryLedgerService.getActivityLog(args || {})));
  secureIpcHandle(IPC_CHANNELS.INVENTORY_LEDGER.GET_VALUATION_REPORT, (_, args) => handleIPCRequest(() => inventoryLedgerService.getValuationReport(args || {})));

  // ─── Payment & Receipt Engine ────────────────────────────────────────────────
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.RECORD, (_, args) => handleIPCRequest(() => paymentEngineService.recordPaymentReceipt(args, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_OPEN_BILLS, (_, args) => handleIPCRequest(() => paymentEngineService.getOpenBills(args.partyType, args.partyId)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.RECORD_CONTRA, (_, args) => handleIPCRequest(() => paymentEngineService.recordContraEntry(args, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_BALANCES, () => handleIPCRequest(() => paymentEngineService.getBalances()));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_VOUCHER, (_, args) => handleIPCRequest(() => paymentEngineService.getVoucher(args.id)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_REGISTER, (_, args) => handleIPCRequest(() => paymentEngineService.getRegister(args || {})));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_DUE_PURCHASES, (_, args) => handleIPCRequest(() => paymentEngineService.getDuePurchasesList(args || {})));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.REVERSE, (_, args) => handleIPCRequest(() => paymentEngineService.reversePayment(args.payment_receipt_id, args.reason, authService.getCurrentUserId() || 1)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_BILL_PAYMENT_HISTORY, (_, args) => handleIPCRequest(() => paymentEngineService.getBillPaymentHistory(args.billType, args.billId)));
  secureIpcHandle(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_OUTSTANDING_BILLS, (_, args) => handleIPCRequest(() => paymentEngineService.getOutstandingPurchaseBills(args || {})));
}


// App Lifecycle
app.on('ready', async () => {
  logger.info('================================================================');
  logger.info(`[STARTUP] Starting POS application...`);
  logger.info(`[STARTUP] Project Root (cwd) : ${process.cwd()}`);
  logger.info(`[STARTUP] Environment         : ${config.env} (isDev: ${isDev})`);
  logger.info(`[STARTUP] Database Path       : ${config.dbPath}`);
  logger.info(`[STARTUP] UserData Path       : ${app.getPath('userData')}`);
  logger.info('================================================================');
  
  // In development, skip the extra splash renderer. Loading two Vite pages
  // during startup adds avoidable work. Production keeps the local splash.
  if (!isDev) {
    createSplashWindow().catch(err => logger.error('Failed to create splash window', err));
  }

  // Setup IPC handlers
  registerIpcHandlers();

  // 3. Initialize database and run migrations
  try {
    logger.info('Running database migrations...');
    migrationEngine.run();
    logger.info('Database migrations completed successfully.');

    // Upgrade seeded users passwords to scrypt if not already upgraded
    authService.upgradeSeededUsers();

    // Start background interval to process pending stock events every 10 seconds
    setInterval(() => {
      try {
        inventoryService.processPendingEvents();
      } catch (err) {
        logger.error('Background processing of pending stock events failed', err);
      }
    }, 10000);
  } catch (err) {
    logger.error('CRITICAL: Database migration failed on startup', err);
    app.quit();
    return;
  }

  // 4. Launch Main Window
  // Do not add an arbitrary startup delay. The window should be created as soon as
  // the database is ready; Vite/Electron already synchronize through the dev URL.
  void createMainWindow();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

let isQuitting = false;
app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    logger.info('Performing automated database shutdown backup...');
    backupService.backupDatabase()
      .then((backupPath) => {
        logger.info('Automated shutdown backup complete', { path: backupPath });
      })
      .catch((err) => {
        logger.error('Automated shutdown backup failed', err);
      })
      .finally(() => {
        isQuitting = true;
        app.quit();
      });
  }
});
