import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { supplierService } from '../../modules/inventory/backend/service/supplier_service';
import { procurementService } from '../../modules/inventory/backend/service/procurement_service';
import { supplierLedgerService } from '../../modules/inventory/backend/service/supplier_ledger_service';
import { procurementReportsService } from '../../modules/inventory/backend/service/procurement_reports_service';
import { authService } from '../../modules/auth/backend/service/auth_service';

app.whenReady().then(async () => {
  console.log('\n==================================================');
  console.log('    STARTING SUPPLIER & PROCUREMENT MODULE TEST');
  console.log('==================================================\n');

  try {
    // 1. Run migrations first
    migrationEngine.run();

    // 2. Mock login as administrator
    authService.login('admin', 'admin123');
    const user = authService.getSession();
    if (!user) throw new Error('User login failed');
    (user as any).userId = user.id;
    console.log(`[INFO] Logged in successfully: { username: '${user.username}', role: '${user.role}' }`);

    // 3. Clean old test suppliers if any
    const oldSupplier = db.prepare("SELECT id FROM suppliers WHERE company_name = 'Test Procurement Vendor'").get() as { id: number } | undefined;
    if (oldSupplier) {
      const sId = oldSupplier.id;
      db.prepare("DELETE FROM supplier_ledger WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM supplier_payment_allocations WHERE purchase_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)").run(sId);
      db.prepare("DELETE FROM supplier_payments WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM purchase_return_items WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE supplier_id = ?)").run(sId);
      db.prepare("DELETE FROM purchase_returns WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM purchase_invoice_items WHERE purchase_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)").run(sId);
      db.prepare("DELETE FROM purchase_invoices WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM goods_receipts WHERE supplier_id = ?)").run(sId);
      db.prepare("DELETE FROM goods_receipts WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id = ?)").run(sId);
      db.prepare("DELETE FROM purchase_orders WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM supplier_debit_notes WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM supplier_credit_notes WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM supplier_price_history WHERE supplier_id = ?").run(sId);
      db.prepare("DELETE FROM suppliers WHERE id = ?").run(sId);
    }
    db.prepare("DELETE FROM supplier_categories WHERE name = 'Primary Meat Wholesaler'").run();

    // 4. Create Category
    console.log('[TEST 1] Creating Supplier Category...');
    const category = supplierService.createCategory('Primary Meat Wholesaler', 'Main distributor of poultry and lamb');
    console.log(`[PASS] Category created successfully: ID ${category.id}, Name: ${category.name}`);

    // 5. Create Supplier
    console.log('[TEST 2] Creating Supplier profile...');
    const supplier = supplierService.createSupplier({
      company_name: 'Test Procurement Vendor',
      owner_name: 'John Doe',
      gstin: '29AAAAA0000A1Z5',
      pan: 'ABCDE1234F',
      phone: '9876543210',
      whatsapp: '9876543210',
      email: 'john@vendor.com',
      category_id: category.id,
      is_preferred: 1,
      credit_limit_paise: 50000 * 100, // ₹50,000 credit limit
      opening_balance_paise: 0,
      notes: 'Main wholesale vendor',
      tags: 'poultry,lamb,fresh'
    }, user.userId) as any;
    console.log(`[PASS] Supplier created successfully. Code: ${supplier.code}, ID: ${supplier.id}`);

    // Verify sub-entities add
    console.log('[TEST 3] Adding supplier contact details...');
    const contact = supplierService.addContact(supplier.id, {
      contact_name: 'Jane Smith',
      phone: '9876543211',
      email: 'jane@vendor.com',
      role: 'Sales Manager'
    });
    console.log(`[PASS] Contact added: ID ${contact.id}, Role: ${contact.role}`);

    // 6. Create Purchase Order (PO)
    console.log('[TEST 4] Creating Purchase Order...');
    
    // Find active variant
    const variant = db.prepare('SELECT id, variant_name, current_rate_paise_per_unit FROM product_variants LIMIT 1').get() as { id: number; variant_name: string; current_rate_paise_per_unit: number };
    if (!variant) throw new Error('No product variants available in database. Seed variants first.');
    const unitType = (db.prepare('SELECT unit_type FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = ?').get(variant.id) as any).unit_type;

    const po = procurementService.createPurchaseOrder({
      supplier_id: supplier.id,
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      notes: 'Test PO for variants',
      items: [{
        product_variant_id: variant.id,
        quantity_ordered: unitType === 'piece' ? 100 : 20000, // 100 pcs or 20kg
        unit_type: unitType,
        unit_price_paise: 120 * 100 // ₹120 per unit/kg
      }]
    }, user.userId) as any;
    console.log(`[PASS] PO created successfully: PO Number ${po.po_number}, Total: ₹${po.total_amount_paise/100}`);

    // Submit PO
    procurementService.submitPurchaseOrder(po.id);
    // Approve PO
    procurementService.approvePurchaseOrder(po.id, user.userId);
    console.log('[PASS] PO successfully submitted and approved');

    // 7. Receive Goods (GRN)
    console.log('[TEST 5] Creating Goods Receipt Note (GRN)...');
    
    const poItems = procurementService.purchaseOrderRepository.findItemsByPoId(po.id) as any[];
    const poItem = poItems[0];

    // Get initial stock levels
    const initialStock = db.prepare('SELECT quantity_grams, quantity_units FROM stock_ledger WHERE product_variant_id = ?').get(variant.id) as { quantity_grams: number | null; quantity_units: number | null };

    const grn = procurementService.createGoodsReceipt({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      delivery_note_number: 'DN-12345',
      received_date: new Date().toISOString().split('T')[0],
      notes: 'Received poultry',
      items: [{
        purchase_order_item_id: poItem.id,
        product_variant_id: variant.id,
        quantity_accepted: poItem.quantity_ordered,
        quantity_rejected: 0,
        rejection_reason: null,
        batch_number: 'BATCH-001',
        expiry_date: new Date(Date.now() + 864000000).toISOString().split('T')[0] // 10 days expiry
      }]
    }, user.userId) as any;
    console.log(`[PASS] GRN successfully created. GRN Number: ${grn.grn_number}`);

    // Verify stock levels increased
    const updatedStock = db.prepare('SELECT quantity_grams, quantity_units FROM stock_ledger WHERE product_variant_id = ?').get(variant.id) as { quantity_grams: number | null; quantity_units: number | null };
    const stockDiff = unitType === 'piece'
      ? (updatedStock.quantity_units ?? 0) - (initialStock.quantity_units ?? 0)
      : (updatedStock.quantity_grams ?? 0) - (initialStock.quantity_grams ?? 0);
    
    console.log(`[TEST 6] Verifying Stock update: Initial: ${initialStock.quantity_units ?? initialStock.quantity_grams}, Updated: ${updatedStock.quantity_units ?? updatedStock.quantity_grams}`);
    if (stockDiff !== poItem.quantity_ordered) {
      throw new Error('Stock level failed to increase by accepted quantity');
    }
    console.log('[PASS] Stock ledger successfully updated by GRN workflow');

    // 8. Create Purchase Invoice (Vendor Bill)
    console.log('[TEST 7] Creating Purchase Invoice...');
    const invoice = procurementService.createPurchaseInvoice({
      invoice_number: `PI-${Date.now()}`,
      supplier_invoice_number: 'VEND-INV-999',
      purchase_order_id: po.id,
      goods_receipt_id: grn.id,
      supplier_id: supplier.id,
      invoice_date: new Date().toISOString().split('T')[0],
      subtotal_paise: po.total_amount_paise,
      gst_paise: Math.round(po.total_amount_paise * 0.05), // 5% GST
      cgst_paise: Math.round(po.total_amount_paise * 0.025),
      sgst_paise: Math.round(po.total_amount_paise * 0.025),
      freight_charges_paise: 500 * 100, // ₹500 freight
      discount_paise: 200 * 100, // ₹200 discount
      total_amount_paise: po.total_amount_paise + Math.round(po.total_amount_paise * 0.05) + (500 * 100) - (200 * 100),
      items: [{
        product_variant_id: variant.id,
        quantity: poItem.quantity_ordered,
        unit_price_paise: poItem.unit_price_paise,
        gst_rate_bps: 500,
        gst_amount_paise: Math.round(po.total_amount_paise * 0.05),
        total_amount_paise: po.total_amount_paise + Math.round(po.total_amount_paise * 0.05)
      }]
    }, user.userId) as any;
    console.log(`[PASS] Purchase Invoice created. Invoice ID: ${invoice.id}, Total: ₹${invoice.total_amount_paise/100}`);

    // Verify supplier outstanding updated
    const updatedSupplier = supplierService.supplierProfileRepository.findById(supplier.id) as any;
    console.log(`[TEST 8] Verifying Supplier Outstanding balance: ₹${updatedSupplier.outstanding_balance_paise/100}`);
    if (updatedSupplier.outstanding_balance_paise !== invoice.total_amount_paise) {
      throw new Error('Supplier outstanding balance failed to increase by invoice total');
    }
    console.log('[PASS] Outstanding balance successfully updated in supplier profile');

    // 9. Record Payment & FIFO allocation
    console.log('[TEST 9] Recording Payment & checking FIFO allocation...');
    const payment = supplierLedgerService.recordPayment({
      supplier_id: supplier.id,
      amount_paise: invoice.total_amount_paise, // Pay complete outstanding
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: 'TXN-987654321',
      notes: 'Cleared invoice via bank transfer'
    }, user.userId) as any;

    const reloadedInvoice = procurementService.purchaseInvoiceRepository.findById(invoice.id) as any;
    console.log(`[TEST 10] Verifying Payment status on Invoice: ${reloadedInvoice.payment_status}, Outstanding amount: ₹${reloadedInvoice.outstanding_amount_paise/100}`);
    if (reloadedInvoice.payment_status !== 'paid' || reloadedInvoice.outstanding_amount_paise !== 0) {
      throw new Error('Invoice failed to clear via FIFO payment allocation');
    }
    console.log('[PASS] Payment completed and FIFO allocation succeeded');

    // 10. Purchase Return & Stock Reversal
    console.log('[TEST 11] Creating Purchase Return for damaged stock...');
    const retQty = unitType === 'piece' ? 10 : 2000; // 10 pcs or 2kg
    const retAmountPaise = retQty * poItem.unit_price_paise;

    const initialStockBeforeReturn = db.prepare('SELECT quantity_grams, quantity_units FROM stock_ledger WHERE product_variant_id = ?').get(variant.id) as { quantity_grams: number | null; quantity_units: number | null };

    const ret = procurementService.createPurchaseReturn({
      purchase_invoice_id: invoice.id,
      supplier_id: supplier.id,
      return_date: new Date().toISOString().split('T')[0],
      reason: 'Damaged item packaging',
      total_refund_amount_paise: retAmountPaise,
      resolved_via: 'debit_note',
      items: [{
        product_variant_id: variant.id,
        quantity: retQty,
        unit_price_paise: poItem.unit_price_paise,
        gst_amount_paise: 0,
        total_amount_paise: retAmountPaise
      }]
    }, user.userId) as any;
    console.log(`[PASS] Purchase Return created successfully. Return number: ${ret.return_number}`);

    // Verify stock levels decreased
    const updatedStockAfterReturn = db.prepare('SELECT quantity_grams, quantity_units FROM stock_ledger WHERE product_variant_id = ?').get(variant.id) as { quantity_grams: number | null; quantity_units: number | null };
    const stockReturnDiff = unitType === 'piece'
      ? (initialStockBeforeReturn.quantity_units ?? 0) - (updatedStockAfterReturn.quantity_units ?? 0)
      : (initialStockBeforeReturn.quantity_grams ?? 0) - (updatedStockAfterReturn.quantity_grams ?? 0);
    
    console.log(`[TEST 12] Verifying Stock reversal: Before Return: ${initialStockBeforeReturn.quantity_units ?? initialStockBeforeReturn.quantity_grams}, After: ${updatedStockAfterReturn.quantity_units ?? updatedStockAfterReturn.quantity_grams}`);
    if (stockReturnDiff !== retQty) {
      throw new Error('Stock level failed to decrease by returned quantity');
    }
    console.log('[PASS] Stock ledger successfully reversed for returned goods');

    // 11. Fetch reports
    console.log('[TEST 13] Extracting Price history charts & supplier statements...');
    const historyTrend = procurementReportsService.getPriceHistoryTrend(variant.id);
    const cheapestSupplier = procurementReportsService.getCheapestSupplier(variant.id);
    console.log(`[PASS] Price History loaded. Cheapest supplier ID: ${cheapestSupplier ? cheapestSupplier.supplier_id : 'none'}`);

    console.log('\n==================================================');
    console.log('    SUPPLIER & PROCUREMENT TESTS COMPLETED SUCCESS!');
    console.log('==================================================\n');
    app.quit();
  } catch (err) {
    console.error('\n[FAIL] SUPPLIER & PROCUREMENT TESTS FAILED:', err);
    app.quit();
    process.exit(1);
  }
});
