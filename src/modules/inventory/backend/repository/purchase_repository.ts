import { db } from '../../../../core/backend/db';
import { NotFoundError } from '../../../../core/backend/errors';

export interface PurchaseRow {
  id: number;
  supplier_id: number;
  product_variant_id: number;
  quantity_grams: number | null;
  quantity_units: number | null;
  cost_paise: number;
  created_by: number;
  created_at: string;
}

export interface PurchaseDetailRow extends PurchaseRow {
  supplier_name: string;
  variant_name: string;
  product_name: string;
  created_by_username: string;
}

export const purchaseRepository = {
  findAll(): PurchaseDetailRow[] {
    return db.prepare(`
      SELECT pr.*, s.name as supplier_name, pv.variant_name, p.name as product_name, u.username as created_by_username
      FROM purchases pr
      JOIN suppliers s ON pr.supplier_id = s.id
      JOIN product_variants pv ON pr.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN users u ON pr.created_by = u.id
      ORDER BY pr.created_at DESC
    `).all() as PurchaseDetailRow[];
  },

  findById(id: number): PurchaseDetailRow {
    const r = db.prepare(`
      SELECT pr.*, s.name as supplier_name, pv.variant_name, p.name as product_name, u.username as created_by_username
      FROM purchases pr
      JOIN suppliers s ON pr.supplier_id = s.id
      JOIN product_variants pv ON pr.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN users u ON pr.created_by = u.id
      WHERE pr.id = ?
    `).get(id) as PurchaseDetailRow | undefined;
    if (!r) throw new NotFoundError(`Purchase with id ${id} not found`);
    return r;
  },

  create(input: {
    supplier_id: number;
    product_variant_id: number;
    quantity_grams: number | null;
    quantity_units: number | null;
    cost_paise: number;
    created_by: number;
  }): PurchaseRow {
    const res = db.prepare(`
      INSERT INTO purchases (supplier_id, product_variant_id, quantity_grams, quantity_units, cost_paise, created_by)
      VALUES (@supplier_id, @product_variant_id, @quantity_grams, @quantity_units, @cost_paise, @created_by)
    `).run(input);
    return this.findById(res.lastInsertRowid as number);
  },
};
