import { db } from '../../../../core/backend/db';

export interface StockTransactionRow {
  id: number;
  product_variant_id: number;
  transaction_type: 'sale_deduction' | 'sale_reversal' | 'manual_adjustment';
  quantity_grams: number | null;
  quantity_units: number | null;
  reference_id: number;
  created_at: string;
}

export interface StockTransactionDetailRow extends StockTransactionRow {
  variant_name: string;
  product_name: string;
  product_code: string;
  unit_type: 'weight' | 'piece';
}

export const stockTransactionRepository = {
  create(input: {
    product_variant_id: number;
    transaction_type: StockTransactionRow['transaction_type'];
    quantity_grams: number | null;
    quantity_units: number | null;
    reference_id: number;
  }): StockTransactionRow {
    const result = db.prepare(`
      INSERT INTO stock_transactions (
        product_variant_id, transaction_type, quantity_grams, quantity_units, reference_id
      ) VALUES (
        @product_variant_id, @transaction_type, @quantity_grams, @quantity_units, @reference_id
      )
    `).run(input);

    const id = result.lastInsertRowid as number;
    return db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(id) as StockTransactionRow;
  },

  findByVariantId(productVariantId: number, limit = 50): StockTransactionDetailRow[] {
    return db.prepare(`
      SELECT st.*, pv.variant_name, p.name as product_name, p.product_code, p.unit_type
      FROM stock_transactions st
      JOIN product_variants pv ON st.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE st.product_variant_id = ?
      ORDER BY st.created_at DESC
      LIMIT ?
    `).all(productVariantId, limit) as StockTransactionDetailRow[];
  },

  findAll(limit = 100): StockTransactionDetailRow[] {
    return db.prepare(`
      SELECT st.*, pv.variant_name, p.name as product_name, p.product_code, p.unit_type
      FROM stock_transactions st
      JOIN product_variants pv ON st.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      ORDER BY st.created_at DESC
      LIMIT ?
    `).all(limit) as StockTransactionDetailRow[];
  }
};
