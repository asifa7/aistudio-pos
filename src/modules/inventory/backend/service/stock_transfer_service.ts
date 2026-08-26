import { db } from '../../../../core/backend/db';
import { ValidationError } from '../../../../core/backend/errors';
import { auditLogger, logger } from '../../../../core/backend/logger';
import { fifoService } from './fifo_service';
import { productVariantsRepository } from '../../../billing/backend/repository/product_variants_repository';
import { inventoryLedgerService } from './inventory_ledger_service';

export interface InitiateTransferInput {
  from_location_id: number;
  to_location_id: number;
  items: Array<{
    product_variant_id: number;
    quantity: number; // weight in Kg or units in Pcs
    unit_cost_paise?: number; // editable unit cost travelling with transfer
  }>;
  notes?: string;
}

export interface ConfirmReceiptInput {
  transfer_id: number;
  items: Array<{
    item_id: number;
    received_quantity_grams: number | null;
    received_quantity_units: number | null;
  }>;
  discrepancy_notes?: string;
}

export class StockTransferService {
  /**
   * Get all active physical store branches
   */
  public getLocations() {
    return db.prepare(`
      SELECT id, code, name, address, phone, is_active, is_default 
      FROM branches 
      WHERE is_active = 1 
      ORDER BY is_default DESC, name ASC
    `).all();
  }

  /**
   * Initiate a stock transfer between physical locations/branches
   */
  public initiateTransfer(input: InitiateTransferInput, userId: number): { success: boolean; transfer_id: number; transfer_number: string } {
    if (input.from_location_id === input.to_location_id) {
      throw new ValidationError('Source and destination branches cannot be the same');
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Please select at least one item to transfer');
    }

    const fromBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(input.from_location_id) as any;
    const toBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(input.to_location_id) as any;
    if (!fromBranch || !toBranch) throw new ValidationError('Invalid source or destination branch');

    const fn = db.transaction(() => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM stock_transfers').get() as any;
      const transferNumber = `TRF-${todayStr}-${String((countRow?.cnt || 0) + 1).padStart(3, '0')}`;

      const res = db.prepare(`
        INSERT INTO stock_transfers (
          transfer_number, from_location_id, to_location_id, status, initiated_by, notes, dispatched_at, received_at
        ) VALUES (?, ?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(transferNumber, input.from_location_id, input.to_location_id, userId, input.notes?.trim() || null);

      const transferId = res.lastInsertRowid as number;

      for (const item of input.items) {
        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.product_variant_id) as any;
        if (!variant) throw new ValidationError(`Product variant #${item.product_variant_id} not found`);

        const isWeight = variant.unit_type === 'weight' || variant.unit_type === 'live_dual';
        const requestedQty = Math.abs(item.quantity);
        let remainingQtyToDeduct = isWeight ? Math.round(requestedQty * 1000) : Math.round(requestedQty);
        const totalSentQty = remainingQtyToDeduct;

        // Fetch all active batches for this variant and location in FIFO order (oldest first)
        const batches = db.prepare(`
          SELECT * FROM product_stock_batches
          WHERE product_variant_id = ? AND (location_id = ? OR location_id IS NULL) AND status = 'active'
          ORDER BY received_date ASC, id ASC
        `).all(item.product_variant_id, input.from_location_id) as any[];

        // Calculate total available stock across all active batches
        const totalAvailable = batches.reduce((sum, b) => {
          const avail = isWeight ? (b.current_quantity_grams ?? 0) : (b.current_quantity_units ?? 0);
          return sum + avail;
        }, 0);

        const requiredStockLabel = isWeight ? `${requestedQty}kg` : `${requestedQty}pcs`;
        const availableStockLabel = isWeight ? `${totalAvailable / 1000}kg` : `${totalAvailable}pcs`;

        if (remainingQtyToDeduct > totalAvailable) {
          throw new ValidationError(`Insufficient stock for ${variant.product_name} (Available: ${availableStockLabel}, Requested: ${requiredStockLabel})`);
        }

        const effectiveUnitCost = item.unit_cost_paise !== undefined && item.unit_cost_paise > 0 
          ? item.unit_cost_paise 
          : (variant.last_purchase_cost_paise || variant.unit_cost_paise_cache || 0);

        // Deduct from source batches in FIFO order
        for (const batch of batches) {
          if (remainingQtyToDeduct <= 0) break;

          const batchAvail = isWeight ? (batch.current_quantity_grams ?? 0) : (batch.current_quantity_units ?? 0);
          if (batchAvail <= 0) continue;

          const deduct = Math.min(remainingQtyToDeduct, batchAvail);
          remainingQtyToDeduct -= deduct;

          const newGrams = isWeight ? (batch.current_quantity_grams ?? 0) - deduct : null;
          const newUnits = !isWeight ? (batch.current_quantity_units ?? 0) - deduct : null;
          const isExhausted = (isWeight && newGrams! <= 0) || (!isWeight && newUnits! <= 0);

          db.prepare(`
            UPDATE product_stock_batches
            SET current_quantity_grams = ?, current_quantity_units = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newGrams, newUnits, isExhausted ? 'exhausted' : 'active', batch.id);

          db.prepare(`
            INSERT INTO stock_transfer_items (
              transfer_id, batch_id, product_variant_id, sent_quantity_grams, sent_quantity_units, received_quantity_grams, received_quantity_units, unit_cost_paise
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            transferId,
            batch.id,
            item.product_variant_id,
            isWeight ? deduct : null,
            !isWeight ? deduct : null,
            isWeight ? deduct : null,
            !isWeight ? deduct : null,
            effectiveUnitCost || batch.unit_cost_paise || 0
          );
        }

        // 1. Deduct from source stock_ledger
        if (isWeight) {
          db.prepare(`
            UPDATE stock_ledger 
            SET quantity_grams = MAX(0, quantity_grams - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE product_variant_id = ? AND (location_id = ? OR location_id IS NULL)
          `).run(totalSentQty, item.product_variant_id, input.from_location_id);
        } else {
          db.prepare(`
            UPDATE stock_ledger 
            SET quantity_units = MAX(0, quantity_units - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE product_variant_id = ? AND (location_id = ? OR location_id IS NULL)
          `).run(totalSentQty, item.product_variant_id, input.from_location_id);
        }

        // Log Transfer Out in inventory_ledger
        inventoryLedgerService.recordEntry({
          product_variant_id: item.product_variant_id,
          branch_id: input.from_location_id,
          action_type: 'transfer_out',
          quantity_grams: isWeight ? totalSentQty : null,
          quantity_units: !isWeight ? totalSentQty : null,
          unit_cost_paise: effectiveUnitCost,
          reference_type: 'stock_transfer',
          reference_id: transferId,
          reference_number: transferNumber,
          notes: `Transfer out to ${toBranch.name} (${toBranch.code})`,
          created_by: userId
        });

        // 2. Direct Receive into destination branch batches & stock_ledger
        const destBatchNumber = `REC-${transferNumber}`;
        db.prepare(`
          INSERT INTO product_stock_batches (
            product_variant_id, batch_number, initial_quantity_grams, current_quantity_grams,
            initial_quantity_units, current_quantity_units, unit_cost_paise, received_date, status, location_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', ?)
        `).run(
          item.product_variant_id,
          destBatchNumber,
          isWeight ? totalSentQty : null,
          isWeight ? totalSentQty : null,
          !isWeight ? totalSentQty : null,
          !isWeight ? totalSentQty : null,
          effectiveUnitCost || 0,
          input.to_location_id
        );

        // Update / Insert destination stock_ledger
        const destStock = db.prepare(`
          SELECT id FROM stock_ledger WHERE product_variant_id = ? AND (location_id = ? OR location_id IS NULL)
        `).get(item.product_variant_id, input.to_location_id) as any;

        if (destStock) {
          if (isWeight) {
            db.prepare('UPDATE stock_ledger SET quantity_grams = quantity_grams + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(totalSentQty, destStock.id);
          } else {
            db.prepare('UPDATE stock_ledger SET quantity_units = quantity_units + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(totalSentQty, destStock.id);
          }
        } else {
          db.prepare(`
            INSERT INTO stock_ledger (product_variant_id, location_id, quantity_grams, quantity_units, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(item.product_variant_id, input.to_location_id, isWeight ? totalSentQty : null, !isWeight ? totalSentQty : null);
        }

        // Log Transfer In in inventory_ledger
        inventoryLedgerService.recordEntry({
          product_variant_id: item.product_variant_id,
          branch_id: input.to_location_id,
          action_type: 'transfer_in',
          quantity_grams: isWeight ? totalSentQty : null,
          quantity_units: !isWeight ? totalSentQty : null,
          unit_cost_paise: effectiveUnitCost,
          reference_type: 'stock_transfer',
          reference_id: transferId,
          reference_number: transferNumber,
          notes: `Stock received directly from ${fromBranch.name} (${fromBranch.code})`,
          created_by: userId
        });

        // Sync cost & stock cache
        productVariantsRepository.syncVariantCostCache(item.product_variant_id);
      }

      auditLogger.log(userId, 'STOCK_TRANSFER_COMPLETED', {
        transferId,
        transferNumber,
        fromBranch: fromBranch.name,
        toBranch: toBranch.name,
        itemCount: input.items.length,
      });

      return { success: true, transfer_id: transferId, transfer_number: transferNumber };
    });

    return fn();
  }

  /**
   * Confirm receipt of a stock transfer at destination branch with discrepancy logging
   */
  public confirmTransferReceipt(input: ConfirmReceiptInput, userId: number): { success: boolean; transfer_id: number } {
    const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(input.transfer_id) as any;
    if (!transfer) throw new ValidationError('Stock transfer record not found');
    if (transfer.status !== 'in_transit' && transfer.status !== 'pending') {
      throw new ValidationError(`Transfer is in status '${transfer.status}' and cannot be received`);
    }

    const fromBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(transfer.from_location_id) as any;
    const toBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(transfer.to_location_id) as any;
    const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(input.transfer_id) as any[];

    const fn = db.transaction(() => {
      let totalShortfallGrams = 0;
      let totalShortfallUnits = 0;

      for (const inputItem of input.items) {
        const item = items.find(i => i.id === inputItem.item_id);
        if (!item) continue;

        const origBatch = db.prepare('SELECT * FROM product_stock_batches WHERE id = ?').get(item.batch_id) as any;

        const isWeight = item.sent_quantity_grams !== null;
        const recGrams = isWeight ? Math.abs(inputItem.received_quantity_grams ?? 0) : null;
        const recUnits = !isWeight ? Math.abs(inputItem.received_quantity_units ?? 0) : null;

        const sentGrams = isWeight ? item.sent_quantity_grams : 0;
        const sentUnits = !isWeight ? item.sent_quantity_units : 0;

        const shortfallGrams = isWeight ? Math.max(0, sentGrams - (recGrams ?? 0)) : 0;
        const shortfallUnits = !isWeight ? Math.max(0, sentUnits - (recUnits ?? 0)) : 0;

        if (shortfallGrams > 0) totalShortfallGrams += shortfallGrams;
        if (shortfallUnits > 0) totalShortfallUnits += shortfallUnits;

        // Update transfer item record
        db.prepare(`
          UPDATE stock_transfer_items
          SET received_quantity_grams = ?, received_quantity_units = ?,
              shortfall_quantity_grams = ?, shortfall_quantity_units = ?
          WHERE id = ?
        `).run(recGrams, recUnits, shortfallGrams, shortfallUnits, item.id);

        // Create new active batch at destination branch retaining ORIGINAL unit cost
        const receivedQty = isWeight ? (recGrams ?? 0) : (recUnits ?? 0);

        if (receivedQty > 0) {
          const destBatchNumber = `${origBatch?.batch_number || 'BAT'}-TRF-${transfer.to_location_id}`;
          db.prepare(`
            INSERT INTO product_stock_batches (
              batch_number, product_variant_id, location_id, received_date,
              initial_quantity_grams, initial_quantity_units,
              current_quantity_grams, current_quantity_units,
              unit_cost_paise, source_type, source_ref_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'adjustment', ?, 'active')
          `).run(
            destBatchNumber,
            item.product_variant_id,
            transfer.to_location_id,
            origBatch?.received_date || new Date().toISOString(),
            recGrams,
            recUnits,
            recGrams,
            recUnits,
            item.unit_cost_paise,
            transfer.id
          );

          // Add to destination stock_ledger
          if (isWeight) {
            db.prepare(`
              INSERT INTO stock_ledger (product_variant_id, location_id, quantity_grams, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(product_variant_id) DO UPDATE SET quantity_grams = quantity_grams + excluded.quantity_grams, updated_at = CURRENT_TIMESTAMP
            `).run(item.product_variant_id, transfer.to_location_id, recGrams);
          } else {
            db.prepare(`
              INSERT INTO stock_ledger (product_variant_id, location_id, quantity_units, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(product_variant_id) DO UPDATE SET quantity_units = quantity_units + excluded.quantity_units, updated_at = CURRENT_TIMESTAMP
            `).run(item.product_variant_id, transfer.to_location_id, recUnits);
          }

          // Record unified inventory_ledger in row at destination branch
          inventoryLedgerService.recordEntry({
            product_variant_id: item.product_variant_id,
            branch_id: transfer.to_location_id,
            action_type: 'transfer_in',
            quantity_grams: isWeight ? recGrams : null,
            quantity_units: !isWeight ? recUnits : null,
            unit_cost_paise: item.unit_cost_paise,
            reference_type: 'stock_transfer',
            reference_id: transfer.id,
            reference_number: transfer.transfer_number,
            notes: `Received transfer from ${fromBranch?.name || 'Source Branch'}`,
            created_by: userId
          });
        }

        // Log Discrepancy Wastage Loss-in-Transit if shortfall exists
        if ((isWeight && shortfallGrams > 0) || (!isWeight && shortfallUnits > 0)) {
          db.prepare(`
            INSERT INTO stock_adjustments (
              product_variant_id, adjustment_type, quantity_grams, quantity_units,
              reason, adjusted_by
            ) VALUES (?, 'damage', ?, ?, ?, ?)
          `).run(
            item.product_variant_id,
            shortfallGrams > 0 ? shortfallGrams : null,
            shortfallUnits > 0 ? shortfallUnits : null,
            `Discrepancy on Transfer ${transfer.transfer_number} (Loss in Transit)`,
            userId
          );

          inventoryLedgerService.recordEntry({
            product_variant_id: item.product_variant_id,
            branch_id: transfer.to_location_id,
            action_type: 'wastage',
            quantity_grams: isWeight ? shortfallGrams : null,
            quantity_units: !isWeight ? shortfallUnits : null,
            unit_cost_paise: item.unit_cost_paise,
            reference_type: 'stock_transfer',
            reference_id: transfer.id,
            reference_number: transfer.transfer_number,
            notes: `Transfer transit loss / shortfall (${transfer.transfer_number})`,
            created_by: userId
          });
        }

        fifoService.syncLedgerBalance(item.product_variant_id);
      }

      // Update transfer status
      db.prepare(`
        UPDATE stock_transfers
        SET status = 'received', confirmed_by = ?, received_at = CURRENT_TIMESTAMP, discrepancy_notes = ?
        WHERE id = ?
      `).run(userId, input.discrepancy_notes?.trim() || null, input.transfer_id);

      auditLogger.log(userId, 'STOCK_TRANSFER_RECEIVED', {
        transferId: input.transfer_id,
        transferNumber: transfer.transfer_number,
        shortfallGrams: totalShortfallGrams,
        shortfallUnits: totalShortfallUnits,
      });

      return { success: true, transfer_id: input.transfer_id as number };
    });

    return fn();
  }

  /**
   * List all stock transfers with branches and item breakdowns
   */
  public listTransfers(statusFilter?: string) {
    let sql = `
      SELECT 
        st.*,
        bf.name as from_location_name,
        bf.code as from_location_code,
        bt.name as to_location_name,
        bt.code as to_location_code,
        u1.full_name as initiated_by_name,
        u2.full_name as confirmed_by_name,
        (SELECT COUNT(*) FROM stock_transfer_items sti WHERE sti.transfer_id = st.id) as item_count
      FROM stock_transfers st
      LEFT JOIN branches bf ON bf.id = st.from_location_id
      LEFT JOIN branches bt ON bt.id = st.to_location_id
      LEFT JOIN users u1 ON u1.id = st.initiated_by
      LEFT JOIN users u2 ON u2.id = st.confirmed_by
    `;

    if (statusFilter && statusFilter !== 'all') {
      sql += ` WHERE st.status = '${statusFilter}'`;
    }

    sql += ' ORDER BY st.created_at DESC';

    const transfers = db.prepare(sql).all() as any[];

    // Attach item details
    for (const t of transfers) {
      t.items = db.prepare(`
        SELECT sti.*, pv.variant_name, pv.product_code, p.name as product_name, p.unit_type
        FROM stock_transfer_items sti
        JOIN product_variants pv ON pv.id = sti.product_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE sti.transfer_id = ?
      `).all(t.id);
    }

    return transfers;
  }
}

export const stockTransferService = new StockTransferService();
