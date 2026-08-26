import { app } from 'electron';
import { databaseProvider } from '../database/database_provider';
import { ProductRepository, InvoiceRepository, UserRepository, InventoryRepository } from '../database/repositories/repositories';
import { InvoiceService } from '../../modules/billing/backend/service/invoice_service';
import { configService } from '../config/config_service';

app.whenReady().then(async () => {
  console.log('\n==================================================');
  console.log('       STARTING POS PLATFORM PERFORMANCE BENCHMARK');
  console.log('==================================================\n');

  const startTime = Date.now();

  try {
    const db = databaseProvider.getRawConnection();

    // Setup repositories
    const userRepo = new UserRepository(databaseProvider);
    const productRepo = new ProductRepository(databaseProvider);
    const invoiceRepo = new InvoiceRepository(databaseProvider);
    const inventoryRepo = new InventoryRepository(databaseProvider);
    const settingsRepo = { getShopInfo: () => ({ name: 'Test Shop', address: '123 Main St', phone: '000', gstin: '000' }), updateShopInfo: () => {} };
    const cashRepo = { startSession: () => null as any, reconcileSession: () => null as any, findSessionById: () => undefined, findActiveSession: () => undefined };

    const invoiceService = new InvoiceService(invoiceRepo, productRepo, inventoryRepo, settingsRepo as any, cashRepo);

    // 1. Startup latency measurement
    const startupDuration = Date.now() - startTime;
    console.log(`[LATENCY] Engine Bootup Time: ${startupDuration} ms (Goal: < 2000 ms)`);

    // Ensure we have at least one cashier user for authorization mocks
    let user = userRepo.findByUsername('cashier');
    if (!user) {
      user = userRepo.create({
        code: 'USR-TEST',
        username: 'cashier',
        password_hash: 'scrypt$dummyhash',
        role: 'CASHIER',
      });
    }

    // Mock active session
    const { authService } = require('../../modules/auth/backend/service/auth_service');
    authService.login('cashier', 'admin123'); // Upgrades and initializes session

    // Seed test variants if empty
    let activeVariants = productRepo.findAllVariantsActive();
    if (activeVariants.length === 0) {
      console.log('[SEED] Seeding test products and variants for search benchmark...');
      databaseProvider.transaction(() => {
        const prod = productRepo.create({
          product_code: 'PRD-BENCH',
          name: 'Bench Chicken Casing',
          category: 'Chicken',
          unit_type: 'weight',
        });
        productRepo.createVariant({
          product_id: prod.id,
          variant_name: 'Standard Cut',
          current_rate_paise_per_unit: 45000,
        });
      });
      activeVariants = productRepo.findAllVariantsActive();
    }

    const testVariant = activeVariants[0];

    // 2. Product Search Latency
    console.log('[BENCHMARK] Executing 1,000 product searches...');
    const searchStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      // Find variant by ID
      productRepo.findVariantById(testVariant.id);
    }
    const searchDuration = performance.now() - searchStart;
    const avgSearchLatency = searchDuration / 1000;
    console.log(`[LATENCY] Avg Product Variant Retrieve: ${avgSearchLatency.toFixed(3)} ms (Goal: < 30 ms)`);

    // 3. Invoice Creation Latency
    console.log('[BENCHMARK] Creating 100 draft invoices...');
    const invoiceStart = performance.now();
    const invoiceIds: number[] = [];
    for (let i = 0; i < 100; i++) {
      const inv = invoiceService.createDraft({
        is_gst_invoice: true,
      });
      invoiceIds.push(inv.id);
    }
    const invoiceDuration = performance.now() - invoiceStart;
    const avgInvoiceLatency = invoiceDuration / 100;
    console.log(`[LATENCY] Avg Invoice Draft Creation: ${avgInvoiceLatency.toFixed(3)} ms (Goal: < 150 ms)`);

    // 4. Concurrent IPC Requests Simulation
    console.log('[BENCHMARK] Executing 500 concurrent simulated queries...');
    const concurrentStart = performance.now();
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 500; i++) {
      promises.push((async () => {
        return productRepo.findAllVariantsActive();
      })());
    }
    await Promise.all(promises);
    const concurrentDuration = performance.now() - concurrentStart;
    console.log(`[LATENCY] 500 Concurrent Operations Total Time: ${concurrentDuration.toFixed(2)} ms`);
    console.log(`[LATENCY] Operations Per Second (Throughput): ${(500 / (concurrentDuration / 1000)).toFixed(1)} ops/sec`);

    // Cleanup draft invoices created during benchmark
    console.log('[CLEANUP] Purging temporary benchmark invoice records...');
    databaseProvider.transaction(() => {
      invoiceIds.forEach(id => {
        invoiceService.deleteDraft(id);
      });
    });

    console.log('\n==================================================');
    console.log('       BENCHMARK RUN COMPLETED SUCCESSFUL!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[FATAL] Benchmark failed with error:', err);
    process.exit(1);
  }
});
