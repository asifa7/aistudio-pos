import { db } from '../../../../core/backend/db';
import { NotFoundError } from '../../../../core/backend/errors';

export interface SupplierRow {
  id: number;
  code: string;
  name: string;
  contact: string | null;
  created_at: string;
  updated_at: string;
}

export const supplierRepository = {
  findAll(): SupplierRow[] {
    return db.prepare('SELECT * FROM suppliers ORDER BY name').all() as SupplierRow[];
  },

  findById(id: number): SupplierRow {
    const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow | undefined;
    if (!s) throw new NotFoundError(`Supplier with id ${id} not found`);
    return s;
  },

  findByCode(code: string): SupplierRow | undefined {
    return db.prepare('SELECT * FROM suppliers WHERE code = ?').get(code) as SupplierRow | undefined;
  },

  create(input: { name: string; contact?: string | null }): SupplierRow {
    const count = db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as { c: number };
    const code = `SPL-${String(count.c + 1).padStart(5, '0')}`;
    const res = db.prepare(`
      INSERT INTO suppliers (code, name, contact)
      VALUES (?, ?, ?)
    `).run(code, input.name, input.contact ?? null);
    return this.findById(res.lastInsertRowid as number);
  },
};
