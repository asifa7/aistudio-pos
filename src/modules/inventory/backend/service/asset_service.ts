import { db } from '../../../../core/backend/db';
import { ValidationError } from '../../../../core/backend/errors';
import { auditLogger, logger } from '../../../../core/backend/logger';

export interface AssetItemRow {
  id: number;
  name: string;
  category: string;
  purchase_cost_paise: number;
  purchase_date: string;
  status: 'active' | 'damaged' | 'replaced' | 'disposed';
  branch_id: number;
  times_replaced: number;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  branch_name?: string;
  created_by_name?: string;
}

export interface AssetReplacementRow {
  id: number;
  asset_id: number;
  replacement_date: string;
  reason: string;
  replacement_cost_paise: number;
  notes: string | null;
  logged_by: number;
  created_at: string;
  logged_by_name?: string;
}

export interface CreateAssetInput {
  name: string;
  category: string;
  purchase_cost_paise: number;
  purchase_date: string;
  status?: 'active' | 'damaged' | 'replaced' | 'disposed';
  branch_id?: number;
  notes?: string;
}

export interface UpdateAssetInput {
  name?: string;
  category?: string;
  purchase_cost_paise?: number;
  purchase_date?: string;
  status?: 'active' | 'damaged' | 'replaced' | 'disposed';
  branch_id?: number;
  notes?: string;
}

export interface RecordReplacementInput {
  asset_id: number;
  replacement_date: string;
  reason: string;
  replacement_cost_paise?: number;
  notes?: string;
}

export class AssetService {
  /**
   * List all assets with category/status/branch filters
   */
  public listAssets(filters?: { category?: string; status?: string; branchId?: number }): (AssetItemRow & { replacements?: AssetReplacementRow[] })[] {
    let sql = `
      SELECT 
        a.*,
        b.name as branch_name,
        u.full_name as created_by_name
      FROM asset_items a
      LEFT JOIN branches b ON b.id = a.branch_id
      LEFT JOIN users u ON u.id = a.created_by
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.category && filters.category !== 'all') {
      sql += ' AND a.category = ?';
      params.push(filters.category);
    }
    if (filters?.status && filters.status !== 'all') {
      sql += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters?.branchId) {
      sql += ' AND a.branch_id = ?';
      params.push(filters.branchId);
    }

    sql += ' ORDER BY a.created_at DESC';

    const assets = db.prepare(sql).all(...params) as AssetItemRow[];

    // Attach replacements history for each asset
    for (const asset of assets) {
      (asset as any).replacements = db.prepare(`
        SELECT r.*, u.full_name as logged_by_name
        FROM asset_replacement_log r
        LEFT JOIN users u ON u.id = r.logged_by
        WHERE r.asset_id = ?
        ORDER BY r.replacement_date DESC, r.created_at DESC
      `).all(asset.id) as AssetReplacementRow[];
    }

    return assets;
  }

  /**
   * Get single asset by ID
   */
  public getAsset(id: number): AssetItemRow & { replacements: AssetReplacementRow[] } {
    const asset = db.prepare(`
      SELECT 
        a.*,
        b.name as branch_name,
        u.full_name as created_by_name
      FROM asset_items a
      LEFT JOIN branches b ON b.id = a.branch_id
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.id = ?
    `).get(id) as AssetItemRow;

    if (!asset) throw new ValidationError('Asset not found');

    const replacements = db.prepare(`
      SELECT r.*, u.full_name as logged_by_name
      FROM asset_replacement_log r
      LEFT JOIN users u ON u.id = r.logged_by
      WHERE r.asset_id = ?
      ORDER BY r.replacement_date DESC, r.created_at DESC
    `).all(id) as AssetReplacementRow[];

    return { ...asset, replacements };
  }

  /**
   * Create a new asset item
   */
  public createAsset(input: CreateAssetInput, userId: number): AssetItemRow {
    const name = input.name.trim();
    const category = input.category.trim();

    if (!name) throw new ValidationError('Asset name is required');
    if (!category) throw new ValidationError('Asset category is required');
    if (!input.purchase_date) throw new ValidationError('Purchase date is required');

    const res = db.prepare(`
      INSERT INTO asset_items (
        name, category, purchase_cost_paise, purchase_date, status, branch_id, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      name,
      category,
      input.purchase_cost_paise || 0,
      input.purchase_date,
      input.status || 'active',
      input.branch_id || 1,
      input.notes?.trim() || null,
      userId
    );

    const created = this.getAsset(res.lastInsertRowid as number);

    auditLogger.log(userId, 'ASSET_CREATED', {
      assetId: created.id,
      name: created.name,
      category: created.category,
      costPaise: created.purchase_cost_paise,
    });

    return created;
  }

  /**
   * Update an asset
   */
  public updateAsset(id: number, input: UpdateAssetInput, userId: number): AssetItemRow {
    const existing = db.prepare('SELECT * FROM asset_items WHERE id = ?').get(id) as AssetItemRow;
    if (!existing) throw new ValidationError('Asset not found');

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const category = input.category !== undefined ? input.category.trim() : existing.category;

    if (!name) throw new ValidationError('Asset name cannot be empty');
    if (!category) throw new ValidationError('Asset category cannot be empty');

    db.prepare(`
      UPDATE asset_items
      SET name = ?, category = ?, purchase_cost_paise = ?, purchase_date = ?,
          status = ?, branch_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      category,
      input.purchase_cost_paise !== undefined ? input.purchase_cost_paise : existing.purchase_cost_paise,
      input.purchase_date !== undefined ? input.purchase_date : existing.purchase_date,
      input.status !== undefined ? input.status : existing.status,
      input.branch_id !== undefined ? input.branch_id : existing.branch_id,
      input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes,
      id
    );

    auditLogger.log(userId, 'ASSET_UPDATED', {
      assetId: id,
      changes: input,
    });

    return this.getAsset(id);
  }

  /**
   * Record an asset replacement event.
   * Increments `times_replaced`, sets status to 'replaced', and inserts into `asset_replacement_log`.
   */
  public recordReplacement(input: RecordReplacementInput, userId: number): { success: boolean; asset: AssetItemRow } {
    const asset = db.prepare('SELECT * FROM asset_items WHERE id = ?').get(input.asset_id) as AssetItemRow;
    if (!asset) throw new ValidationError('Asset not found');

    if (!input.reason?.trim()) throw new ValidationError('Replacement reason is required');
    if (!input.replacement_date) throw new ValidationError('Replacement date is required');

    const fn = db.transaction(() => {
      // 1. Insert into replacement log
      db.prepare(`
        INSERT INTO asset_replacement_log (
          asset_id, replacement_date, reason, replacement_cost_paise, notes, logged_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        input.asset_id,
        input.replacement_date,
        input.reason.trim(),
        input.replacement_cost_paise || 0,
        input.notes?.trim() || null,
        userId
      );

      // 2. Increment times_replaced and update status
      db.prepare(`
        UPDATE asset_items
        SET status = 'replaced',
            times_replaced = times_replaced + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.asset_id);

      auditLogger.log(userId, 'ASSET_REPLACED', {
        assetId: input.asset_id,
        name: asset.name,
        reason: input.reason,
        replacementCost: input.replacement_cost_paise,
      });

      return { success: true, asset: this.getAsset(input.asset_id) };
    });

    return fn();
  }

  /**
   * Delete an asset
   */
  public deleteAsset(id: number, userId: number): { success: boolean } {
    const asset = db.prepare('SELECT * FROM asset_items WHERE id = ?').get(id) as AssetItemRow;
    if (!asset) throw new ValidationError('Asset not found');

    db.prepare('DELETE FROM asset_items WHERE id = ?').run(id);

    auditLogger.log(userId, 'ASSET_DELETED', {
      assetId: id,
      name: asset.name,
    });

    return { success: true };
  }

  /**
   * Get Total Asset Valuation and breakdown
   */
  public getAssetValuationSummary(branchId?: number) {
    let activeCostSql = `
      SELECT 
        COUNT(*) as active_count,
        COALESCE(SUM(purchase_cost_paise), 0) as total_active_cost_paise
      FROM asset_items
      WHERE status = 'active'
    `;
    let totalCountSql = `
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN status = 'replaced' THEN 1 ELSE 0 END), 0) as replaced_count,
        COALESCE(SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END), 0) as damaged_count,
        COALESCE(SUM(CASE WHEN status = 'disposed' THEN 1 ELSE 0 END), 0) as disposed_count
      FROM asset_items
      WHERE 1=1
    `;

    const params: any[] = [];
    if (branchId) {
      activeCostSql += ' AND branch_id = ?';
      totalCountSql += ' AND branch_id = ?';
      params.push(branchId);
    }

    const activeRow = db.prepare(activeCostSql).get(...params) as any;
    const countRow = db.prepare(totalCountSql).get(...params) as any;

    // Categories breakdown
    let catSql = `
      SELECT 
        category,
        COUNT(*) as total_items,
        COALESCE(SUM(CASE WHEN status = 'active' THEN purchase_cost_paise ELSE 0 END), 0) as active_cost_paise
      FROM asset_items
      WHERE 1=1
    `;
    if (branchId) catSql += ' AND branch_id = ?';
    catSql += ' GROUP BY category ORDER BY active_cost_paise DESC';

    const categoryBreakdown = db.prepare(catSql).all(...params) as any[];

    return {
      totalActiveCostPaise: activeRow?.total_active_cost_paise || 0,
      activeCount: activeRow?.active_count || 0,
      totalCount: countRow?.total_count || 0,
      replacedCount: countRow?.replaced_count || 0,
      damagedCount: countRow?.damaged_count || 0,
      disposedCount: countRow?.disposed_count || 0,
      categoryBreakdown,
    };
  }
}

export const assetService = new AssetService();
