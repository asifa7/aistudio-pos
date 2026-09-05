import { db } from '../../../../core/backend/db';
import { ReportAlert } from '../../types/reports.types';

export class ReportAlertsService {
  /**
   * Evaluate real-time system thresholds and return actionable alerts
   * with pre-filtered direct links to target reports.
   */
  public generateReportAlerts(): ReportAlert[] {
    const alerts: ReportAlert[] = [];

    // 1. Shift Cash Variance Alert (> ₹500 in past 7 days)
    try {
      const shiftVarRow = db.prepare(`
        SELECT COUNT(*) as count, SUM(ABS(difference_paise)) as total_var_paise
        FROM shift_closing_records
        WHERE ABS(difference_paise) > 50000 AND closed_at >= datetime('now', '-7 days')
      `).get() as any;

      if (shiftVarRow && shiftVarRow.count > 0) {
        alerts.push({
          id: 'alert_cash_variance',
          severity: 'critical',
          title: 'Shift Cash Discrepancy Detected',
          message: `${shiftVarRow.count} shift(s) closed with cash variance exceeding ₹500 in the past 7 days (Total: ₹${(shiftVarRow.total_var_paise / 100).toFixed(2)}).`,
          targetReportId: 'shift_closing_report',
          metricValue: shiftVarRow.count,
          thresholdValue: 500,
        });
      }
    } catch (e) {
      // Table might be initializing
    }

    // 2. Margin Erosion / Purchase Cost Spike Alert
    try {
      const marginSpikeRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM product_variants pv
        WHERE pv.is_active = 1 
          AND pv.last_purchase_cost > 0 
          AND pv.last_purchase_cost > pv.current_rate_paise_per_unit
      `).get() as any;

      if (marginSpikeRow && marginSpikeRow.count > 0) {
        alerts.push({
          id: 'alert_margin_erosion',
          severity: 'warning',
          title: 'Product Purchase Cost Exceeds Selling Rate',
          message: `${marginSpikeRow.count} active product(s) have purchase costs higher than current selling prices. Gross margins are negative.`,
          targetReportId: 'purchase_price_variance_report',
          metricValue: marginSpikeRow.count,
          thresholdValue: 0,
        });
      }
    } catch (e) {
      // Ignore
    }

    // 3. Unreconciled UPI Payments Alert
    try {
      const upiRow = db.prepare(`
        SELECT COUNT(*) as count, SUM(amount_paise) as total_upi_paise
        FROM payments
        WHERE method = 'upi' AND (reference_number IS NULL OR reference_number = '')
      `).get() as any;

      if (upiRow && upiRow.count > 0) {
        alerts.push({
          id: 'alert_upi_unreconciled',
          severity: 'warning',
          title: 'UPI Payments Missing Reference ID',
          message: `${upiRow.count} UPI payment(s) total ₹${(upiRow.total_upi_paise / 100).toFixed(2)} lack bank transaction IDs.`,
          targetReportId: 'upi_report',
          metricValue: upiRow.count,
          thresholdValue: 0,
        });
      }
    } catch (e) {
      // Ignore
    }

    // 4. Dead Stock Alert (> 30 days without sale)
    try {
      const deadStockRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM product_variants pv
        JOIN stock_ledger sl ON pv.id = sl.product_variant_id
        LEFT JOIN (
          SELECT product_variant_id, MAX(i.completed_at) as last_sold
          FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id
          WHERE i.status = 'completed'
          GROUP BY product_variant_id
        ) ls ON pv.id = ls.product_variant_id
        WHERE pv.is_active = 1
          AND (sl.quantity_grams > 0 OR sl.quantity_units > 0)
          AND (ls.last_sold IS NULL OR CAST(JULIANDAY('now') - JULIANDAY(ls.last_sold) AS INTEGER) > 30)
      `).get() as any;

      if (deadStockRow && deadStockRow.count > 0) {
        alerts.push({
          id: 'alert_dead_stock',
          severity: 'info',
          title: 'Slow-Moving / Dead Stock Alert',
          message: `${deadStockRow.count} product(s) in stock have had no customer sales in over 30 days. Consider markdown or clearance promotion.`,
          targetReportId: 'dead_stock_report',
          metricValue: deadStockRow.count,
          thresholdValue: 30,
        });
      }
    } catch (e) {
      // Ignore
    }

    return alerts;
  }
}

export const reportAlertsService = new ReportAlertsService();
