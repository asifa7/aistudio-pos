import { db } from '../../../../core/backend/db';
import {
  SavedReport,
  RecentReportItem,
  CustomReportBuilderConfig,
} from '../../types/reports.types';

export class SavedReportsService {
  /**
   * Save or update a custom report configuration
   */
  public saveReport(input: {
    id?: number;
    name: string;
    description?: string;
    category?: string;
    dataSource: string;
    configuration: CustomReportBuilderConfig;
    isFavorite?: boolean;
    createdBy: number;
  }): SavedReport {
    const configJson = JSON.stringify(input.configuration);
    const category = input.category || 'Custom';
    const isFav = input.isFavorite ? 1 : 0;

    if (input.id) {
      db.prepare(`
        UPDATE saved_reports
        SET name = ?, description = ?, category = ?, data_source = ?,
            configuration_json = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.name, input.description || null, category, input.dataSource, configJson, isFav, input.id);

      return this.getSavedReportById(input.id)!;
    }

    const res = db.prepare(`
      INSERT INTO saved_reports (name, description, category, data_source, configuration_json, is_favorite, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.name, input.description || null, category, input.dataSource, configJson, isFav, input.createdBy);

    const newId = Number(res.lastInsertRowid);
    return this.getSavedReportById(newId)!;
  }

  /**
   * Fetch all saved custom reports
   */
  public getSavedReports(userId?: number): SavedReport[] {
    let query = `
      SELECT id, name, description, category, data_source, configuration_json, is_favorite, created_by, created_at, updated_at
      FROM saved_reports
    `;
    const params: any[] = [];

    if (userId) {
      query += ` WHERE created_by = ?`;
      params.push(userId);
    }
    query += ` ORDER BY updated_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => this.mapRowToSavedReport(r));
  }

  /**
   * Fetch saved report by ID
   */
  public getSavedReportById(id: number): SavedReport | null {
    const row = db.prepare(`
      SELECT id, name, description, category, data_source, configuration_json, is_favorite, created_by, created_at, updated_at
      FROM saved_reports
      WHERE id = ?
    `).get(id) as any;

    if (!row) return null;
    return this.mapRowToSavedReport(row);
  }

  /**
   * Delete saved report
   */
  public deleteSavedReport(id: number): boolean {
    const res = db.prepare(`DELETE FROM saved_reports WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  /**
   * Star / Favorite toggle for any report (built-in or saved)
   */
  public toggleFavorite(userId: number, reportId: string): boolean {
    const existing = db.prepare(`
      SELECT id FROM report_favorite_items WHERE user_id = ? AND report_id = ?
    `).get(userId, reportId) as any;

    if (existing) {
      db.prepare(`DELETE FROM report_favorite_items WHERE id = ?`).run(existing.id);
      return false; // un-favorited
    } else {
      db.prepare(`
        INSERT INTO report_favorite_items (user_id, report_id) VALUES (?, ?)
      `).run(userId, reportId);
      return true; // favorited
    }
  }

  /**
   * Fetch all favorite report IDs for user
   */
  public getFavoriteReportIds(userId: number): string[] {
    const rows = db.prepare(`
      SELECT report_id FROM report_favorite_items WHERE user_id = ?
    `).all(userId) as { report_id: string }[];
    return rows.map(r => r.report_id);
  }

  /**
   * Record access in recently viewed reports list
   */
  public recordRecentReport(input: {
    userId: number;
    reportId: string;
    reportName: string;
    category: string;
    parameters?: any;
  }): void {
    const paramsJson = input.parameters ? JSON.stringify(input.parameters) : null;
    db.prepare(`
      INSERT INTO recent_reports (user_id, report_id, report_name, category, last_accessed_at, parameters_json)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(user_id, report_id) DO UPDATE SET
        last_accessed_at = CURRENT_TIMESTAMP,
        report_name = excluded.report_name,
        category = excluded.category,
        parameters_json = excluded.parameters_json
    `).run(input.userId, input.reportId, input.reportName, input.category, paramsJson);
  }

  /**
   * Fetch recent reports for user
   */
  public getRecentReports(userId: number, limit: number = 10): RecentReportItem[] {
    const rows = db.prepare(`
      SELECT report_id, report_name, category, last_accessed_at
      FROM recent_reports
      WHERE user_id = ?
      ORDER BY last_accessed_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];

    return rows.map(r => ({
      reportId: r.report_id,
      reportName: r.report_name,
      category: r.category,
      lastAccessedAt: r.last_accessed_at,
      isCustom: r.report_id.startsWith('custom_') || !isNaN(Number(r.report_id))
    }));
  }

  private mapRowToSavedReport(row: any): SavedReport {
    let config: CustomReportBuilderConfig;
    try {
      config = JSON.parse(row.configuration_json);
    } catch {
      config = {
        name: row.name,
        dataSource: row.data_source,
        dimensions: [],
        measures: [],
      };
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      category: row.category || 'Custom',
      dataSource: row.data_source,
      configuration: config,
      isFavorite: Boolean(row.is_favorite),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const savedReportsService = new SavedReportsService();
