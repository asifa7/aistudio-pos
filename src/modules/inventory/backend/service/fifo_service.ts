import { db } from '../../../../core/backend/db';
import { stockBatchRepository, StockBatchRow } from '../repository/stock_batch_repository';
import { container } from '../../../../core/di/container';
import { productVariantsRepository } from '../../../billing/backend/repository/product_variants_repository';

export interface FifoDrawdownResult {
  product_variant_id: number;
  total_deducted_grams: number | null;
  total_deducted_units: number | null;
  total_cogs_paise: number;
  real_cogs_paise: number;
  estimated_cogs_paise: number;
  is_estimated_cogs: number;
  batches_drawn: Array<{
    batch_id: number;
    batch_number: string;
    drawn_grams: number | null;
    drawn_units: number | null;
    unit_cost_paise: number;
    subtotal_cost_paise: number;
  }>;
}

export class FifoService {
  /**
   * Draw down stock from active batches using First-In-First-Out (FIFO)
   */
  public drawdownFifo(
    productVariantId: number,
    requestGrams: number | null,
    requestUnits: number | null,
    requestCount?: number | null
  ): FifoDrawdownResult {
    const isWeight = requestGrams !== null;
    let remainingGrams = requestGrams ? Math.abs(requestGrams) : 0;
    let remainingUnits = requestUnits ? Math.abs(requestUnits) : 0;
    let remainingCount = requestCount ? Math.abs(requestCount) : 0;

    const activeBatches = stockBatchRepository.getActiveBatchesByVariant(productVariantId);
    let realCogsPaise = 0;
    let estimatedCogsPaise = 0;
    const batchesDrawn: FifoDrawdownResult['batches_drawn'] = [];

    let totalDeductedGrams = 0;
    let totalDeductedUnits = 0;

    for (const batch of activeBatches) {
      if (isWeight) {
        if (remainingGrams <= 0) break;
        const currentBatchGrams = batch.current_quantity_grams ?? 0;
        if (currentBatchGrams === 0) continue;

        const drawGrams = Math.min(currentBatchGrams, remainingGrams);
        const newBatchGrams = currentBatchGrams - drawGrams;
        remainingGrams -= drawGrams;
        totalDeductedGrams += drawGrams;

        // Proportional count deduction for live_dual batches
        let newBatchCount: number | null = null;
        if (batch.current_count !== undefined && batch.current_count !== null && batch.current_count > 0) {
          const countDraw = (drawGrams / currentBatchGrams) * batch.current_count;
          newBatchCount = Math.max(0, batch.current_count - countDraw);
          if (remainingCount > 0) {
            remainingCount = Math.max(0, remainingCount - countDraw);
          }
        }

        // Calculate COGS (unit_cost_paise is per kg or per unit; for weight in grams: drawGrams / 1000 * unit_cost)
        const batchCogsPaise = Math.round((drawGrams / 1000) * batch.unit_cost_paise);
        realCogsPaise += batchCogsPaise;

        stockBatchRepository.updateBatchQuantity(batch.id, newBatchGrams, null, newBatchCount);

        batchesDrawn.push({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          drawn_grams: drawGrams,
          drawn_units: null,
          unit_cost_paise: batch.unit_cost_paise,
          subtotal_cost_paise: batchCogsPaise,
        });
      } else {
        if (remainingUnits <= 0) break;
        const currentBatchUnits = batch.current_quantity_units ?? 0;
        if (currentBatchUnits === 0) continue;

        const drawUnits = Math.min(currentBatchUnits, remainingUnits);
        const newBatchUnits = currentBatchUnits - drawUnits;
        remainingUnits -= drawUnits;
        totalDeductedUnits += drawUnits;

        const batchCogsPaise = drawUnits * batch.unit_cost_paise;
        realCogsPaise += batchCogsPaise;

        stockBatchRepository.updateBatchQuantity(batch.id, null, newBatchUnits);

        batchesDrawn.push({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          drawn_grams: null,
          drawn_units: drawUnits,
          unit_cost_paise: batch.unit_cost_paise,
          subtotal_cost_paise: batchCogsPaise,
        });
      }
    }

    // If remaining quantity > 0 (oversold override scenario), calculate shortfall COGS using last known/variant cost
    if ((isWeight && remainingGrams > 0) || (!isWeight && remainingUnits > 0)) {
      const variantCostRow = db.prepare('SELECT cost_price_paise_per_unit, weighted_average_cost FROM product_variants WHERE id = ?').get(productVariantId) as { cost_price_paise_per_unit: number | null; weighted_average_cost: number | null } | undefined;
      const fallbackUnitCost = (variantCostRow?.weighted_average_cost && variantCostRow.weighted_average_cost > 0)
        ? variantCostRow.weighted_average_cost
        : (variantCostRow?.cost_price_paise_per_unit || (batchesDrawn.length > 0 ? batchesDrawn[batchesDrawn.length - 1].unit_cost_paise : 0));

      estimatedCogsPaise = isWeight ? Math.round((remainingGrams / 1000) * fallbackUnitCost) : (remainingUnits * fallbackUnitCost);
      
      const shortfallBatchNum = `OVERSOLD-${Date.now().toString().slice(-6)}-${productVariantId}`;
      try {
        db.prepare(`
          INSERT INTO product_stock_batches (
            batch_number, product_variant_id, 
            current_quantity_grams, current_quantity_units, current_count,
            unit_cost_paise, source_type, status
          ) VALUES (?, ?, ?, ?, 0, ?, 'adjustment', 'active')
        `).run(
          shortfallBatchNum,
          productVariantId,
          isWeight ? -remainingGrams : null,
          !isWeight ? -remainingUnits : null,
          Math.round(fallbackUnitCost)
        );
      } catch (e) {
        console.error('Failed to insert negative batch:', e);
      }

      batchesDrawn.push({
        batch_id: 0,
        batch_number: shortfallBatchNum,
        drawn_grams: isWeight ? remainingGrams : null,
        drawn_units: !isWeight ? remainingUnits : null,
        unit_cost_paise: Math.round(fallbackUnitCost),
        subtotal_cost_paise: estimatedCogsPaise,
      });

      if (isWeight) {
        totalDeductedGrams += remainingGrams;
        remainingGrams = 0;
      } else {
        totalDeductedUnits += remainingUnits;
        remainingUnits = 0;
      }
    }

    const totalCogsPaise = realCogsPaise + estimatedCogsPaise;
    const isEstimatedCogs = estimatedCogsPaise > 0 ? 1 : 0;

    // Sync stock_ledger total to match total active batch quantities
    this.syncLedgerBalance(productVariantId);

    return {
      product_variant_id: productVariantId,
      total_deducted_grams: isWeight ? totalDeductedGrams : null,
      total_deducted_units: !isWeight ? totalDeductedUnits : null,
      total_cogs_paise: totalCogsPaise,
      real_cogs_paise: realCogsPaise,
      estimated_cogs_paise: estimatedCogsPaise,
      is_estimated_cogs: isEstimatedCogs,
      batches_drawn: batchesDrawn,
    };
  }

  /**
   * Sync stock_ledger summary balance with active batches
   */
  public syncLedgerBalance(productVariantId: number): void {
    const row = db.prepare(`
      SELECT 
        SUM(COALESCE(current_quantity_grams, 0)) as total_grams,
        SUM(COALESCE(current_quantity_units, 0)) as total_units,
        SUM(COALESCE(current_count, 0)) as total_count
      FROM product_stock_batches
      WHERE product_variant_id = ? AND status = 'active'
    `).get(productVariantId) as { total_grams: number | null; total_units: number | null; total_count: number | null };

    const variant = db.prepare(`
      SELECT p.unit_type 
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id = ?
    `).get(productVariantId) as { unit_type: 'weight' | 'piece' | 'live_dual' } | undefined;
    if (!variant) return;

    const isLiveDual = variant.unit_type === 'live_dual';
    const isWeight = variant.unit_type === 'weight' || isLiveDual;
    const totalGrams = isWeight ? (row?.total_grams ?? 0) : null;
    const totalUnits = variant.unit_type === 'piece' ? (row?.total_units ?? 0) : null;
    const totalCount = isLiveDual ? (row?.total_count ?? 0) : 0;

    db.prepare(`
      UPDATE stock_ledger
      SET quantity_grams = ?, quantity_units = ?, quantity_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_variant_id = ?
    `).run(totalGrams, totalUnits, totalCount, productVariantId);

    // Sync the product variants cost and stock cache
    productVariantsRepository.syncVariantCostCache(productVariantId);
  }
}

export const fifoService = new FifoService();
