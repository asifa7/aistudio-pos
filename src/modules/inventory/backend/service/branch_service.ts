import { db } from '../../../../core/backend/db';
import { ValidationError } from '../../../../core/backend/errors';
import { auditLogger, logger } from '../../../../core/backend/logger';

export interface BranchRow {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBranchInput {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  is_default?: boolean;
}

export interface UpdateBranchInput {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  is_default?: boolean;
}

export class BranchService {
  /**
   * List all branches (both active and inactive) with transaction count metadata
   */
  public listBranches(): (BranchRow & { has_history: boolean; transfer_count: number })[] {
    const branches = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM stock_transfers st WHERE st.from_location_id = b.id OR st.to_location_id = b.id) as transfer_count,
        (SELECT COUNT(*) FROM inventory_ledger il WHERE il.branch_id = b.id) as ledger_count
      FROM branches b
      ORDER BY b.is_default DESC, b.is_active DESC, b.name ASC
    `).all() as any[];

    return branches.map(b => ({
      ...b,
      has_history: (b.transfer_count > 0 || b.ledger_count > 0)
    }));
  }

  /**
   * Get all active branches (for transaction dropdowns)
   */
  public getActiveBranches(): BranchRow[] {
    return db.prepare(`
      SELECT * FROM branches 
      WHERE is_active = 1 
      ORDER BY is_default DESC, name ASC
    `).all() as BranchRow[];
  }

  /**
   * Create a new branch
   */
  public createBranch(input: CreateBranchInput, userId: number): BranchRow {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    if (!code) throw new ValidationError('Branch code is required');
    if (!name) throw new ValidationError('Branch name is required');

    const existing = db.prepare('SELECT id FROM branches WHERE code = ?').get(code);
    if (existing) {
      throw new ValidationError(`Branch with code "${code}" already exists`);
    }

    const fn = db.transaction(() => {
      if (input.is_default) {
        db.prepare('UPDATE branches SET is_default = 0').run();
      }

      const res = db.prepare(`
        INSERT INTO branches (code, name, address, phone, is_active, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        code,
        name,
        input.address?.trim() || null,
        input.phone?.trim() || null,
        input.is_default ? 1 : 0
      );

      const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(res.lastInsertRowid) as BranchRow;

      auditLogger.log(userId, 'BRANCH_CREATED', {
        branchId: branch.id,
        code: branch.code,
        name: branch.name,
      });

      return branch;
    });

    return fn();
  }

  /**
   * Update an existing branch
   */
  public updateBranch(id: number, input: UpdateBranchInput, userId: number): BranchRow {
    const existing = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow;
    if (!existing) throw new ValidationError('Branch not found');

    const code = input.code ? input.code.trim().toUpperCase() : existing.code;
    const name = input.name ? input.name.trim() : existing.name;

    if (!code) throw new ValidationError('Branch code cannot be empty');
    if (!name) throw new ValidationError('Branch name cannot be empty');

    const duplicate = db.prepare('SELECT id FROM branches WHERE code = ? AND id != ?').get(code, id);
    if (duplicate) {
      throw new ValidationError(`Branch with code "${code}" already exists`);
    }

    const fn = db.transaction(() => {
      if (input.is_default) {
        db.prepare('UPDATE branches SET is_default = 0').run();
      }

      db.prepare(`
        UPDATE branches
        SET code = ?, name = ?, address = ?, phone = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        code,
        name,
        input.address !== undefined ? (input.address?.trim() || null) : existing.address,
        input.phone !== undefined ? (input.phone?.trim() || null) : existing.phone,
        input.is_default !== undefined ? (input.is_default ? 1 : 0) : existing.is_default,
        id
      );

      const updated = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow;

      auditLogger.log(userId, 'BRANCH_UPDATED', {
        branchId: id,
        changes: input,
      });

      return updated;
    });

    return fn();
  }

  /**
   * Toggle branch active / inactive status
   */
  public toggleActive(id: number, isActive: boolean, userId: number): BranchRow {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow;
    if (!branch) throw new ValidationError('Branch not found');

    if (!isActive && branch.is_default === 1) {
      throw new ValidationError('The default primary branch cannot be deactivated');
    }

    db.prepare(`
      UPDATE branches 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(isActive ? 1 : 0, id);

    auditLogger.log(userId, 'BRANCH_STATUS_TOGGLED', {
      branchId: id,
      isActive,
    });

    return db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow;
  }

  /**
   * Attempt deletion of branch (blocked if transaction history exists)
   */
  public deleteBranch(id: number, userId: number): { success: boolean } {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as BranchRow;
    if (!branch) throw new ValidationError('Branch not found');

    if (branch.is_default === 1) {
      throw new ValidationError('Default branch cannot be deleted');
    }

    // Check transaction history
    const transferCount = (db.prepare('SELECT COUNT(*) as c FROM stock_transfers WHERE from_location_id = ? OR to_location_id = ?').get(id, id) as any)?.c || 0;
    const ledgerCount = (db.prepare('SELECT COUNT(*) as c FROM inventory_ledger WHERE branch_id = ?').get(id) as any)?.c || 0;
    const assetCount = (db.prepare('SELECT COUNT(*) as c FROM asset_items WHERE branch_id = ?').get(id) as any)?.c || 0;

    if (transferCount > 0 || ledgerCount > 0 || assetCount > 0) {
      throw new ValidationError('This branch has existing transaction and stock history. It cannot be deleted. You can deactivate it instead to prevent new transactions.');
    }

    db.prepare('DELETE FROM branches WHERE id = ?').run(id);

    auditLogger.log(userId, 'BRANCH_DELETED', {
      branchId: id,
      code: branch.code,
      name: branch.name,
    });

    return { success: true };
  }
}

export const branchService = new BranchService();
