import { db } from '../../../../core/backend/db';

export interface StockAdjustmentRow {
  id: number;
  product_variant_id: number;
  adjustment_type: 'stock_in' | 'stock_out' | 'wastage' | 'damage';
  quantity_grams: number | null;
  quantity_units: number | null;
  reason: string;
  adjusted_by: number;
  created_at: string;
}

export interface StockAdjustmentDetailRow extends StockAdjustmentRow {
  variant_name: string;
  product_name: string;
  product_code: string;
  unit_type: 'weight' | 'piece';
  adjusted_by_username: string;
}

export const stockAdjustmentRepository = {
  create(input: {
    product_variant_id: number;
    adjustment_type: StockAdjustmentRow['adjustment_type'];
    quantity_grams: number | null;
    quantity_units: number | null;
    reason: string;
    adjusted_by: number;
  }): StockAdjustmentRow {
    const result = db.prepare(`
      INSERT INTO stock_adjustments (
        product_variant_id, adjustment_type, quantity_grams, quantity_units, reason, adjusted_by
      ) VALUES (
        @product_variant_id, @adjustment_type, @quantity_grams, @quantity_units, @reason, @adjusted_by
      )
    `).run(input);

    const id = result.lastInsertRowid as number;
    return db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(id) as StockAdjustmentRow;
  },

  findAll(limit = 100): StockAdjustmentDetailRow[] {
    return db.prepare(`
      SELECT sa.*, pv.variant_name, p.name as product_name, p.product_code, p.unit_type, u.username as adjusted_by_username
      FROM stock_adjustments sa
      JOIN product_variants pv ON sa.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN users u ON sa.adjusted_by = u.id
      ORDER BY sa.created_at DESC
      LIMIT ?
    `).all(limit) as StockAdjustmentDetailRow[];
  }
};
