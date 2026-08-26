import { db } from '../../../../core/backend/db';
import { productVariantsRepository } from '../../../billing/backend/repository/product_variants_repository';

export interface StockBatchRow {
  id: number;
  batch_number: string;
  product_variant_id: number;
  location_id?: number;
  location_name?: string;
  received_date: string;
  initial_quantity_grams: number | null;
  initial_quantity_units: number | null;
  initial_count?: number | null;
  current_quantity_grams: number | null;
  current_quantity_units: number | null;
  current_count?: number | null;
  unit_cost_paise: number;
  source_type: 'purchase' | 'yield_processing' | 'initial_balance' | 'adjustment';
  source_ref_id: number | null;
  status: 'active' | 'exhausted';
  created_at: string;
  updated_at: string;
}

export interface CreateStockBatchInput {
  batch_number: string;
  product_variant_id: number;
  location_id?: number;
  received_date?: string;
  quantity_grams: number | null;
  quantity_units: number | null;
  quantity_count?: number | null;
  unit_cost_paise: number;
  source_type: 'purchase' | 'yield_processing' | 'initial_balance' | 'adjustment';
  source_ref_id?: number | null;
}

export class StockBatchRepository {
  public createBatch(input: CreateStockBatchInput): StockBatchRow {
    const receivedDate = input.received_date || new Date().toISOString();
    const isWeight = input.quantity_grams !== null;
    const initialGrams = isWeight ? input.quantity_grams : null;
    const initialUnits = !isWeight ? input.quantity_units : null;
    const initialCount = input.quantity_count !== undefined && input.quantity_count !== null ? input.quantity_count : null;
    const locationId = input.location_id || 1;

    const stmt = db.prepare(`
      INSERT INTO product_stock_batches (
        batch_number, product_variant_id, location_id, received_date,
        initial_quantity_grams, initial_quantity_units, initial_count,
        current_quantity_grams, current_quantity_units, current_count,
        unit_cost_paise, source_type, source_ref_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const res = stmt.run(
      input.batch_number,
      input.product_variant_id,
      locationId,
      receivedDate,
      initialGrams,
      initialUnits,
      initialCount,
      initialGrams,
      initialUnits,
      initialCount,
      input.unit_cost_paise,
      input.source_type,
      input.source_ref_id ?? null
    );

    // Sync product variant cost and stock cache
    productVariantsRepository.syncVariantCostCache(input.product_variant_id);

    return db.prepare('SELECT * FROM product_stock_batches WHERE id = ?').get(res.lastInsertRowid) as StockBatchRow;
  }

  public getActiveBatchesByVariant(productVariantId: number, locationId?: number): StockBatchRow[] {
    if (locationId) {
      return db.prepare(`
        SELECT psb.*, loc.name as location_name
        FROM product_stock_batches psb
        LEFT JOIN locations loc ON loc.id = psb.location_id
        WHERE psb.product_variant_id = ? AND psb.location_id = ? AND psb.status = 'active'
        ORDER BY psb.received_date ASC, psb.id ASC
      `).all(productVariantId, locationId) as StockBatchRow[];
    }

    return db.prepare(`
      SELECT psb.*, loc.name as location_name
      FROM product_stock_batches psb
      LEFT JOIN locations loc ON loc.id = psb.location_id
      WHERE psb.product_variant_id = ? AND psb.status = 'active'
      ORDER BY psb.received_date ASC, psb.id ASC
    `).all(productVariantId) as StockBatchRow[];
  }

  public getAllBatchesForVariant(productVariantId: number, locationId?: number): StockBatchRow[] {
    if (locationId) {
      return db.prepare(`
        SELECT psb.*, loc.name as location_name
        FROM product_stock_batches psb
        LEFT JOIN locations loc ON loc.id = psb.location_id
        WHERE psb.product_variant_id = ? AND psb.location_id = ?
        ORDER BY psb.received_date DESC, psb.id DESC
      `).all(productVariantId, locationId) as StockBatchRow[];
    }

    return db.prepare(`
      SELECT psb.*, loc.name as location_name
      FROM product_stock_batches psb
      LEFT JOIN locations loc ON loc.id = psb.location_id
      WHERE psb.product_variant_id = ?
      ORDER BY psb.received_date DESC, psb.id DESC
    `).all(productVariantId) as StockBatchRow[];
  }

  public updateBatchQuantity(batchId: number, currentGrams: number | null, currentUnits: number | null, currentCount?: number | null): void {
    const isExhausted = (currentGrams !== null && currentGrams <= 0) || (currentUnits !== null && currentUnits <= 0) || (currentCount !== undefined && currentCount !== null && currentCount <= 0);
    const status = isExhausted ? 'exhausted' : 'active';

    const batch = db.prepare('SELECT product_variant_id FROM product_stock_batches WHERE id = ?').get(batchId) as { product_variant_id: number } | undefined;

    if (currentCount !== undefined) {
      db.prepare(`
        UPDATE product_stock_batches
        SET current_quantity_grams = ?, current_quantity_units = ?, current_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(currentGrams, currentUnits, currentCount, status, batchId);
    } else {
      db.prepare(`
        UPDATE product_stock_batches
        SET current_quantity_grams = ?, current_quantity_units = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(currentGrams, currentUnits, status, batchId);
    }

    if (batch) {
      productVariantsRepository.syncVariantCostCache(batch.product_variant_id);
    }
  }
}

export const stockBatchRepository = new StockBatchRepository();
