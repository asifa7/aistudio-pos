import { db } from '../../../../core/backend/db';
import { ValidationError } from '../../../../core/backend/errors';
import { logger } from '../../../../core/backend/logger';

export type InventoryActionType = 
  | 'purchase'
  | 'sale'
  | 'return'
  | 'transfer_out'
  | 'transfer_in'
  | 'yield_in'
  | 'yield_out'
  | 'audit_adjustment'
  | 'wastage'
  | 'fridge_removal'
  | 'fridge_deposit';

export interface InventoryLedgerEntryInput {
  product_variant_id: number;
  branch_id?: number;
  action_type: InventoryActionType;
  quantity_grams?: number | null;
  quantity_units?: number | null;
  unit_cost_paise?: number;
  reference_type?: 'purchase' | 'invoice' | 'stock_transfer' | 'yield_batch' | 'stock_adjustment' | 'manual' | string;
  reference_id?: number | null;
  reference_number?: string | null;
  notes?: string | null;
  created_by?: number | null;
}

export interface InventoryLedgerActivityFilter {
  startDate?: string;
  endDate?: string;
  productVariantIds?: number[];
  actionTypes?: string[];
  branchId?: number;
  limit?: number;
  offset?: number;
}

export class InventoryLedgerService {
  /**
   * Record an atomic inventory ledger entry.
   * Calculates running balance and stores the single source of truth row.
   */
  public recordEntry(input: InventoryLedgerEntryInput): number {
    const branchId = input.branch_id || 1;
    const variantId = input.product_variant_id;

    const variant = db.prepare('SELECT pv.*, p.unit_type FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = ?').get(variantId) as any;
    if (!variant) {
      logger.warn(`Cannot write to inventory_ledger: variant #${variantId} not found`);
      return 0;
    }

    const isWeight = variant.unit_type === 'weight' || variant.unit_type === 'live_dual';

    // Get current stock balance from stock_ledger for this variant & branch
    let currentGrams = 0;
    let currentUnits = 0;

    const stockRow = db.prepare(`
      SELECT quantity_grams, quantity_units 
      FROM stock_ledger 
      WHERE product_variant_id = ? AND (location_id = ? OR location_id IS NULL)
      LIMIT 1
    `).get(variantId, branchId) as any;

    if (stockRow) {
      currentGrams = stockRow.quantity_grams ?? 0;
      currentUnits = stockRow.quantity_units ?? 0;
    }

    // Determine unit cost
    let unitCostPaise = input.unit_cost_paise ?? 0;
    if (unitCostPaise <= 0) {
      unitCostPaise = variant.last_purchase_cost_paise || variant.unit_cost_paise_cache || variant.current_rate_paise_per_unit || 0;
    }

    const insertStmt = db.prepare(`
      INSERT INTO inventory_ledger (
        product_variant_id, branch_id, action_type,
        quantity_grams, quantity_units,
        running_balance_grams, running_balance_units,
        unit_cost_paise, reference_type, reference_id, reference_number,
        notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const res = insertStmt.run(
      variantId,
      branchId,
      input.action_type,
      input.quantity_grams !== undefined ? input.quantity_grams : null,
      input.quantity_units !== undefined ? input.quantity_units : null,
      isWeight ? currentGrams : null,
      !isWeight ? currentUnits : null,
      unitCostPaise,
      input.reference_type || null,
      input.reference_id || null,
      input.reference_number || null,
      input.notes || null,
      input.created_by || 1
    );

    return res.lastInsertRowid as number;
  }

  /**
   * Get activity log with comprehensive filtering for the Inventory Stock Report
   */
  public getActivityLog(filters: InventoryLedgerActivityFilter) {
    let sql = `
      SELECT 
        il.*,
        pv.variant_name,
        p.name as product_name,
        p.unit_type,
        b.name as branch_name,
        b.code as branch_code,
        u.full_name as created_by_name
      FROM inventory_ledger il
      JOIN product_variants pv ON pv.id = il.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN branches b ON b.id = il.branch_id
      LEFT JOIN users u ON u.id = il.created_by
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.startDate) {
      sql += ' AND date(il.created_at) >= date(?)';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND date(il.created_at) <= date(?)';
      params.push(filters.endDate);
    }
    if (filters.productVariantIds && filters.productVariantIds.length > 0) {
      const placeholders = filters.productVariantIds.map(() => '?').join(',');
      sql += ` AND il.product_variant_id IN (${placeholders})`;
      params.push(...filters.productVariantIds);
    }
    if (filters.actionTypes && filters.actionTypes.length > 0) {
      const placeholders = filters.actionTypes.map(() => '?').join(',');
      sql += ` AND il.action_type IN (${placeholders})`;
      params.push(...filters.actionTypes);
    }
    if (filters.branchId) {
      sql += ' AND il.branch_id = ?';
      params.push(filters.branchId);
    }

    sql += ' ORDER BY il.created_at DESC, il.id DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = db.prepare(sql).all(...params) as any[];

    return rows.map(row => {
      const isWeight = row.unit_type === 'weight' || row.unit_type === 'live_dual';
      const qty = isWeight 
        ? (row.quantity_grams !== null ? row.quantity_grams / 1000 : null)
        : row.quantity_units;

      const balance = isWeight
        ? (row.running_balance_grams !== null ? row.running_balance_grams / 1000 : 0)
        : (row.running_balance_units ?? 0);

      return {
        ...row,
        is_weight: isWeight,
        quantity_display: qty,
        running_balance_display: balance,
        unit_label: isWeight ? 'kg' : 'pcs'
      };
    });
  }

  /**
   * Get Live Product Stock Valuation Report
   */
  public getValuationReport(filters: {
    startDate?: string;
    endDate?: string;
    productVariantIds?: number[];
    branchId?: number;
  }) {
    let sql = `
      SELECT 
        pv.id as variant_id,
        pv.variant_name,
        pv.product_code,
        pv.current_rate_paise_per_unit as selling_price_paise,
        COALESCE(pv.last_purchase_cost_paise, pv.unit_cost_paise_cache, pv.current_rate_paise_per_unit, 0) as buying_cost_paise,
        p.id as product_id,
        p.name as product_name,
        p.category,
        p.unit_type,
        p.stock_classification,
        COALESCE(sl.quantity_grams, 0) as quantity_grams,
        COALESCE(sl.quantity_units, 0) as quantity_units
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN stock_ledger sl ON sl.product_variant_id = pv.id
      WHERE pv.is_active = 1 AND p.is_active = 1
    `;

    const params: any[] = [];

    if (filters.productVariantIds && filters.productVariantIds.length > 0) {
      const placeholders = filters.productVariantIds.map(() => '?').join(',');
      sql += ` AND pv.id IN (${placeholders})`;
      params.push(...filters.productVariantIds);
    }

    sql += ' ORDER BY p.category ASC, p.name ASC, pv.variant_name ASC';

    const rawVariants = db.prepare(sql).all(...params) as any[];

    let grandTotalBuyingPaise = 0;
    let grandTotalSellingPaise = 0;
    let grandTotalPotentialProfitPaise = 0;

    const items = rawVariants.map(v => {
      const isWeight = v.unit_type === 'weight' || v.unit_type === 'live_dual';
      const qtyNumber = isWeight ? (v.quantity_grams / 1000) : v.quantity_units;

      const buyingCostPaise = v.buying_cost_paise || 0;
      const sellingPricePaise = v.selling_price_paise || 0;

      const totalBuyingPaise = Math.round(qtyNumber * buyingCostPaise);
      const totalSellingPaise = Math.round(qtyNumber * sellingPricePaise);
      const potentialProfitPaise = totalSellingPaise - totalBuyingPaise;

      grandTotalBuyingPaise += totalBuyingPaise;
      grandTotalSellingPaise += totalSellingPaise;
      grandTotalPotentialProfitPaise += potentialProfitPaise;

      return {
        variant_id: v.variant_id,
        product_id: v.product_id,
        product_name: v.product_name,
        variant_name: v.variant_name,
        product_code: v.product_code,
        category: v.category,
        unit_type: v.unit_type,
        stock_classification: v.stock_classification,
        is_weight: isWeight,
        quantity: qtyNumber,
        unit_label: isWeight ? 'kg' : 'pcs',
        buying_cost_paise: buyingCostPaise,
        selling_price_paise: sellingPricePaise,
        total_buying_paise: totalBuyingPaise,
        total_selling_paise: totalSellingPaise,
        potential_profit_paise: potentialProfitPaise,
      };
    });

    return {
      items,
      summary: {
        itemCount: items.length,
        totalBuyingValuePaise: grandTotalBuyingPaise,
        totalPotentialSellingValuePaise: grandTotalSellingPaise,
        potentialProfitPaise: grandTotalPotentialProfitPaise,
        profitMarginPercent: grandTotalSellingPaise > 0 
          ? Number(((grandTotalPotentialProfitPaise / grandTotalSellingPaise) * 100).toFixed(2))
          : 0,
      }
    };
  }
}

export const inventoryLedgerService = new InventoryLedgerService();
