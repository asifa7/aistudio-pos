import { db, dbManager } from '../../../../core/backend/db';
import type { Transaction } from 'better-sqlite3';
import { ConflictError, ValidationError } from '../../../../core/backend/errors';
import { productsRepository, type ProductRow } from '../../../billing/backend/repository/products_repository';
import { productVariantsRepository, type ProductVariantRow } from '../../../billing/backend/repository/product_variants_repository';
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '../validation/create_product.schema';
import { createVariantSchema, updateVariantSchema, type CreateVariantInput } from '../validation/create_variant.schema';
import { updateRateSchema, type UpdateRateInput } from '../validation/update_rate.schema';
import { authService } from '../../../auth/backend/service/auth_service';
import { auditLogger } from '../../../../core/backend/logger';

/** Auto-generate a unique product code, e.g. PRD-00001, PRD-00002 */
function generateProductCode(): string {
  const count = productsRepository.countAll();
  return `PRD-${String(count + 1).padStart(5, '0')}`;
}

export interface AdminProductVariant extends ProductVariantRow {
  rateHistory: { id: number; rate_paise_per_unit: number; effective_from: string; set_by: number }[];
  hasInvoiceHistory: boolean;
}

export interface AdminProduct extends ProductRow {
  variants: AdminProductVariant[];
  hasInvoiceHistory: boolean;
}

const productManagementService = {
  /**
   * Returns all products (including inactive) with their variants and rate history.
   * Grouped display order is handled by the frontend fixed taxonomy.
   */
  getAllProducts(): AdminProduct[] {
    const products = productsRepository.findAllWithInactive();
    return products.map(p => {
      const variants = productVariantsRepository.findAllByProductId(p.id);
      const adminVariants: AdminProductVariant[] = variants.map(v => ({
        ...v,
        rateHistory: productVariantsRepository.getRateHistory(v.id),
        hasInvoiceHistory: productVariantsRepository.hasInvoiceHistory(v.id),
      }));
      return {
        ...p,
        variants: adminVariants,
        hasInvoiceHistory: productsRepository.hasInvoiceHistory(p.id),
      };
    });
  },

  /**
   * Create a new product. Category must be from the fixed four-item taxonomy.
   * Product code is auto-generated.
   */
  createProduct(raw: unknown): ProductRow {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const input = createProductSchema.parse(raw) as CreateProductInput;
    const code = generateProductCode();
    // Ensure uniqueness (race condition safety)
    const existing = productsRepository.findByCode(code);
    const finalCode = existing ? `PRD-${String(Date.now()).slice(-6)}` : code;
    return productsRepository.create({
      product_code: finalCode,
      name: input.name,
      unit_type: input.unit_type,
      category: input.category,
      is_processed_cut: input.is_processed_cut,
    });
  },

  /**
   * Update a product's name or category.
   * unit_type cannot be changed if this product has invoice history.
   */
  updateProduct(id: number, raw: unknown): ProductRow {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const input = updateProductSchema.parse(raw) as UpdateProductInput;
    if (input.unit_type) {
      const hasHistory = productsRepository.hasInvoiceHistory(id);
      if (hasHistory) {
        throw new ConflictError(
          'Cannot change unit_type: this product has historical invoice records. Changing weight↔piece would make past quantity data meaningless.'
        );
      }
    }
    return productsRepository.update(id, input as any);
  },

  /**
   * Deactivate a product and cascade to ALL its variants — atomically in one transaction.
   */
  deactivateProduct(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const deactivate = db.transaction(() => {
      productsRepository.update(id, { is_active: 0 });
      productVariantsRepository.deactivateAllForProduct(id);
    });
    deactivate();
  },

  /**
   * Reactivate a product (variants are NOT automatically reactivated — owner must re-enable each).
   */
  reactivateProduct(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    productsRepository.update(id, { is_active: 1 });
  },

  /**
   * Delete a product and ALL its variants/rate histories — only allowed if zero invoice history.
   * Service-layer check: does NOT trust client-side assertions.
   */
  deleteProduct(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const hasHistory = productsRepository.hasInvoiceHistory(id);
    if (hasHistory) {
      throw new ConflictError(
        'Cannot hard-delete: this product has historical invoice records. Use deactivate instead.'
      );
    }
    const deleteAll = db.transaction(() => {
      const variants = productVariantsRepository.findAllByProductId(id);
      for (const v of variants) {
        db.prepare('DELETE FROM product_variant_rate_history WHERE product_variant_id = ?').run(v.id);
      }
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      productsRepository.hardDelete(id);
    });
    deleteAll();
  },

  /**
   * Create a variant under an existing product.
   * The initial rate IS the first row in product_variant_rate_history.
   * Both writes happen in a single transaction.
   */
  createVariant(raw: unknown, setBy?: number): ProductVariantRow {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const input = createVariantSchema.parse(raw) as CreateVariantInput;
    // Verify product exists and get its processed cut status
    const parentProduct = productsRepository.findById(input.product_id);
    const userId = setBy ?? authService.getCurrentUserId();

    let newVariant: ProductVariantRow;
    const insert = db.transaction(() => {
      newVariant = productVariantsRepository.create({
        product_id: input.product_id,
        variant_name: input.variant_name,
        current_rate_paise_per_unit: input.rate_paise,
        is_processed_cut: (parentProduct as any).is_processed_cut ?? 0,
      });
      productVariantsRepository.insertRateHistory(newVariant.id, input.rate_paise, userId);
    });
    insert();
    return newVariant!;
  },

  /**
   * Update a variant's name.
   */
  updateVariantName(variantId: number, raw: unknown): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const input = updateVariantSchema.parse(raw);
    if (input.variant_name) {
      productVariantsRepository.updateName(variantId, input.variant_name);
    }
  },

  /**
   * Change a variant's pricing rate.
   * Inserts a new product_variant_rate_history row — NEVER silently overwrites.
   * Updates product_variants.current_rate_paise_per_unit — both in one transaction.
   * effective_from is always "now" in this pass (scheduling future rates is a future feature).
   */
  updateVariantRate(raw: unknown): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const input = updateRateSchema.parse(raw) as UpdateRateInput;
    const userId = authService.getCurrentUserId();
    const update = db.transaction(() => {
      productVariantsRepository.insertRateHistory(input.variant_id, input.new_rate_paise, userId);
      productVariantsRepository.updateRate(input.variant_id, input.new_rate_paise);
    });
    update();
  },

  /**
   * Deactivate a single variant. Does not affect the parent product or siblings.
   */
  deactivateVariant(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    productVariantsRepository.deactivate(id);
  },

  /**
   * Reactivate a variant. If the parent product is inactive, reactivates it too — atomically.
   */
  reactivateVariant(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const variant = productVariantsRepository.findById(id);
    const reactivate = db.transaction(() => {
      productVariantsRepository.reactivate(id);
      // If parent product was inactive, wake it up too
      const product = productsRepository.findById(variant.product_id);
      if (product.is_active === 0) {
        productsRepository.update(product.id, { is_active: 1 });
      }
    });
    reactivate();
  },

  /**
   * Hard-delete a variant and its rate history.
   * Server-side check: rejects if variant has ever been invoiced.
   */
  deleteVariant(id: number): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const hasHistory = productVariantsRepository.hasInvoiceHistory(id);
    if (hasHistory) {
      throw new ConflictError(
        'Cannot hard-delete: this variant has historical invoice records. Use deactivate instead.'
      );
    }
    productVariantsRepository.hardDelete(id);
  },

  getRateHistory(variantId: number) {
    return productVariantsRepository.getRateHistory(variantId);
  },

  updateVariantYield(variantId: number, parentVariantId: number | null, yieldRatio: number | null): void {
    authService.requireRole(['ADMIN', 'MANAGER']);
    dbManager.transaction(() => {
      db.prepare(`
        UPDATE product_variants 
        SET parent_variant_id = ?, yield_ratio = ? 
        WHERE id = ?
      `).run(parentVariantId, yieldRatio, variantId);
    });
  },

  /**
   * Preview bulk import rows without persisting any data.
   * Returns per‑row validation results.
   */
  previewImportRows(rows: Array<any>): Array<{ rowIndex: number; status: 'Valid' | 'New' | 'Update' | 'Error'; messages?: string[] }> {
    const results: Array<{ rowIndex: number; status: 'Valid' | 'New' | 'Update' | 'Error'; messages?: string[] }> = [];
    const allowedCategories = ['Fresh Cuts', 'Meat', 'Seafood', 'Vegetables']; // example taxonomy
    rows.forEach((row, idx) => {
      const messages: string[] = [];
      const code = row.product_code?.trim();
      const existing = code ? productsRepository.findByCode(code) : null;

      // Validate mandatory fields
      if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
        messages.push('Missing or empty product name');
      }
      if (!row.category || typeof row.category !== 'string' || !allowedCategories.includes(row.category.trim())) {
        messages.push(`Invalid category '${row.category}'`);
      }
      const unitType = (row.unit_type?.toLowerCase() === 'piece' ? 'piece' : 'weight') as 'weight' | 'piece';
      if (!row.unit_type || (row.unit_type.toLowerCase() !== 'piece' && row.unit_type.toLowerCase() !== 'weight')) {
        messages.push('Invalid unit_type, must be "piece" or "weight"');
      }
      const priceVal = Number(row.price_rupees);
      const priceValid = !isNaN(priceVal) && priceVal > 0;
      if (!priceValid) {
        messages.push('price_rupees is not a valid positive number');
      }
      // For new products, price must be present
      if (!existing && !priceValid) {
        messages.push('New product requires a valid price');
      }
      // cost_price optional but must be numeric if present
      const costVal = Number(row.cost_price_rupees);
      if (row.cost_price_rupees && (isNaN(costVal) || costVal < 0)) {
        messages.push('cost_price_rupees is not a valid non‑negative number');
      }

      if (messages.length > 0) {
        results.push({ rowIndex: idx, status: 'Error', messages });
        return;
      }

      const status = existing ? 'Update' : 'New';
      results.push({ rowIndex: idx, status });
    });
    return results;
  },

  /**
   * Perform the actual bulk import after preview validation.
   * Rows flagged as Error are skipped. Each successful row is processed in its own transaction.
   */
  bulkImportProducts(rows: Array<any>): { createdCount: number; updatedCount: number; errorRows: Array<{ rowIndex: number; messages: string[] }> } {
    authService.requireRole(['ADMIN', 'MANAGER', 'CASHIER']);
    let createdCount = 0;
    let updatedCount = 0;
    const errorRows: Array<{ rowIndex: number; messages: string[] }> = [];

    rows.forEach((row, idx) => {
      // Re‑run validation the same way as preview to ensure safety
      const priceVal = Number(row.price_rupees);
      const costVal = Number(row.cost_price_rupees);
      const unitType = (row.unit_type?.toLowerCase() === 'piece' ? 'piece' : 'weight') as 'weight' | 'piece';
      const code = row.product_code?.trim();
      const existing = code ? productsRepository.findByCode(code) : null;
      const isProcessedCut = row.type?.toLowerCase().includes('process') ? 1 : 0;
      const trackInInv = row.track_in_inventory !== undefined ? (row.track_in_inventory ? 1 : 0) : (isProcessedCut === 0 ? 1 : 0);

      // Basic validation – skip if invalid
      const priceValid = !isNaN(priceVal) && priceVal > 0;
      if (!priceValid) {
        errorRows.push({ rowIndex: idx, messages: ['price_rupees is not a valid positive number'] });
        return;
      }

      const ratePaise = Math.round(priceVal * 100);
      const costPaise = !isNaN(costVal) && costVal >= 0 ? Math.round(costVal * 100) : 0;

      const transaction = db.transaction(() => {
        if (existing) {
          // Update product fields
          productsRepository.update(existing.id, {
            name: row.name?.trim() || existing.name,
            category: row.category?.trim() || existing.category,
            is_processed_cut: isProcessedCut,
          });

          db.prepare('UPDATE products SET track_in_inventory = ? WHERE id = ?').run(trackInInv, existing.id);

          // Variant handling
          const variants = productVariantsRepository.findAllByProductId(existing.id);
          const vName = row.variant_name?.trim() || 'Default';
          const targetVariant = variants.find(v => v.variant_name === vName) || variants[0];

          if (targetVariant && ratePaise > 0) {
            productVariantsRepository.updateRate(targetVariant.id, ratePaise);
          }
          if (targetVariant && costPaise > 0) {
            db.prepare('UPDATE product_variants SET cost_price_paise_per_unit = ? WHERE id = ?').run(costPaise, targetVariant.id);
          }
          if (targetVariant) {
            db.prepare('UPDATE product_variants SET track_in_inventory = ? WHERE id = ?').run(trackInInv, targetVariant.id);
            productVariantsRepository.syncVariantCostCache(targetVariant.id);
          }
          updatedCount++;
        } else {
          // Create new product & variant
          const finalCode = code || generateProductCode();
          const p = productsRepository.create({
            product_code: finalCode,
            name: row.name?.trim() || 'New Item',
            unit_type: unitType,
            category: row.category?.trim() || 'Fresh Cuts',
            is_processed_cut: isProcessedCut,
          });

          db.prepare('UPDATE products SET track_in_inventory = ? WHERE id = ?').run(trackInInv, p.id);

          const vName = row.variant_name?.trim() || 'Default';
          const vRes = productVariantsRepository.create({
            product_id: p.id,
            variant_name: vName,
            current_rate_paise_per_unit: ratePaise,
          });

          db.prepare('UPDATE product_variants SET track_in_inventory = ? WHERE id = ?').run(trackInInv, vRes.id);

          if (costPaise > 0) {
            db.prepare('UPDATE product_variants SET cost_price_paise_per_unit = ? WHERE id = ?').run(costPaise, vRes.id);
          }
          productVariantsRepository.syncVariantCostCache(vRes.id);
          createdCount++;
        }
      });
      transaction();
    });

    // Audit log for the bulk import run
    const userId = authService.getCurrentUserId();
    auditLogger.log(userId, 'BULK_PRODUCT_IMPORT', {
      createdCount,
      updatedCount,
      errorRows,
    });
    return { createdCount, updatedCount, errorRows };
  },

  /**
   * Update product inventory tracking mode with mandatory audit trail reason
   */
  updateProductTracking(id: number, trackInInventory: boolean, reason: string, userId?: number): void {
    const existing = productsRepository.findById(id) as any;
    const oldVal = existing.track_in_inventory ?? (existing.is_processed_cut === 0 ? 1 : 0);
    const newVal = trackInInventory ? 1 : 0;

    const transaction = db.transaction(() => {
      // 1. Update product and variants
      db.prepare('UPDATE products SET track_in_inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newVal, id);
      db.prepare('UPDATE product_variants SET track_in_inventory = ? WHERE product_id = ?').run(newVal, id);

      // 2. Insert audit log
      const user = userId ? db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any : null;
      db.prepare(`
        INSERT INTO product_tracking_change_log (
          product_id, old_track_in_inventory, new_track_in_inventory, reason, changed_by, changed_by_name
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        oldVal,
        newVal,
        reason ? reason.trim() : 'Manual mode toggle',
        userId || null,
        user?.username || 'Cashier'
      );
    });
    transaction();
  },

  /**
   * Get tracking history audit records for a product
   */
  getProductTrackingHistory(productId: number): any[] {
    return db.prepare(`
      SELECT * FROM product_tracking_change_log 
      WHERE product_id = ? 
      ORDER BY created_at DESC
    `).all(productId);
  },
};

export { productManagementService };
