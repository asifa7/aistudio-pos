import { db } from '../../../../core/backend/db';
import { NotFoundError } from '../../../../core/backend/errors';

export interface ProductRow {
  id: number;
  product_code: string;
  name: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  category: string;
  is_processed_cut: number;
  stock_classification?: 'live_yield' | 'refrigerator_direct' | string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  product_code: string;
  name: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  category: string;
  is_processed_cut?: number;
  stock_classification?: 'live_yield' | 'refrigerator_direct' | string;
}

const productsRepository = {
  findAll(): ProductRow[] {
    return db.prepare(
      'SELECT * FROM products WHERE is_active = 1 ORDER BY category, name'
    ).all() as ProductRow[];
  },

  findAllWithInactive(): ProductRow[] {
    return db.prepare(
      'SELECT * FROM products ORDER BY category, name'
    ).all() as ProductRow[];
  },

  findById(id: number): ProductRow {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
    if (!row) {
      throw new NotFoundError(`Product with id ${id} not found`);
    }
    return row;
  },

  findByCode(productCode: string): ProductRow | undefined {
    return db.prepare(
      'SELECT * FROM products WHERE product_code = ?'
    ).get(productCode) as ProductRow | undefined;
  },

  create(input: CreateProductInput): ProductRow {
    const isProcessedCut = input.is_processed_cut ?? 0;
    const stockClassification = input.stock_classification ?? 'refrigerator_direct';
    const stmt = db.prepare(
      `INSERT INTO products (product_code, name, unit_type, category, is_processed_cut, stock_classification)
       VALUES (@product_code, @name, @unit_type, @category, @is_processed_cut, @stock_classification)`
    );
    const result = stmt.run({ ...input, is_processed_cut: isProcessedCut, stock_classification: stockClassification });
    return productsRepository.findById(result.lastInsertRowid as number);
  },

  update(id: number, fields: Partial<Pick<ProductRow, 'name' | 'category' | 'unit_type' | 'is_active' | 'is_processed_cut' | 'stock_classification'>>): ProductRow {
    const existing = productsRepository.findById(id);
    const name = fields.name ?? existing.name;
    const category = fields.category ?? existing.category;
    const unit_type = fields.unit_type ?? existing.unit_type;
    const is_active = fields.is_active ?? existing.is_active;
    const is_processed_cut = fields.is_processed_cut ?? existing.is_processed_cut;
    const stock_classification = fields.stock_classification ?? (existing.stock_classification || 'refrigerator_direct');

    db.prepare(
      `UPDATE products SET name = @name, category = @category, unit_type = @unit_type, is_active = @is_active, is_processed_cut = @is_processed_cut, stock_classification = @stock_classification, updated_at = CURRENT_TIMESTAMP WHERE id = @id`
    ).run({ id, name, category, unit_type, is_active, is_processed_cut, stock_classification });

    return productsRepository.findById(id);
  },

  listCategories(): string[] {
    const rows = db.prepare(
      'SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category'
    ).all() as { category: string }[];
    return rows.map(r => r.category);
  },

  /**
   * Returns true if any invoice_item references a variant belonging to this product.
   * Used to gate hard-delete vs deactivate decisions.
   */
  hasInvoiceHistory(id: number): boolean {
    const row = db.prepare(`
      SELECT 1 FROM invoice_items ii
      JOIN product_variants pv ON ii.product_variant_id = pv.id
      WHERE pv.product_id = ?
      LIMIT 1
    `).get(id);
    return row !== undefined;
  },

  /**
   * Hard-deletes a product row. Only call after confirming hasInvoiceHistory returns false.
   */
  hardDelete(id: number): void {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  },

  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
    return row.cnt;
  },
};

export { productsRepository };
