import { db } from '../../../../core/backend/db';
import { auditLogger, logger } from '../../../../core/backend/logger';
import { ValidationError } from '../../../../core/backend/errors';

export interface CalendarEventRow {
  id: number;
  event_name: string;
  event_date: string;
  impact_level: 'High' | 'Normal' | 'Low' | 'Very_Low';
  notes?: string | null;
  created_at: string;
}

export interface BulkOrderRow {
  id: number;
  delivery_date: string;
  product_variant_id: number;
  product_name?: string;
  variant_name?: string;
  unit_type?: 'weight' | 'piece';
  quantity_grams: number | null;
  quantity_units: number | null;
  customer_name_or_notes: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  created_by: number;
  created_at: string;
}

export interface ItemSalesAnalytics {
  product_variant_id: number;
  product_name: string;
  variant_name: string;
  product_code: string;
  category: string;
  unit_type: 'weight' | 'piece';
  avg_daily_7d: number; // in kg or units
  avg_daily_30d: number;
  avg_daily_90d: number;
  day_of_week_averages: Record<number, number>; // 0=Sunday, 1=Monday ... 6=Saturday
  has_sufficient_data: boolean; // >= 7 days of sales history
  total_historical_days: number;
  days_stock_left: number | null; // null if 0 daily sales or insufficient data
  days_left_status: 'urgent' | 'low' | 'healthy' | 'no_data';
}

export interface PurchasingSuggestion {
  product_variant_id: number;
  product_name: string;
  variant_name: string;
  product_code: string;
  category: string;
  unit_type: 'weight' | 'piece';
  current_stock: number; // in kg or units
  safety_threshold: number;
  avg_daily_30d: number;
  target_3day_forecast: number; // Sum of forecasted demand for next 3 days
  safety_buffer: number; // 1 day average
  bulk_orders_addition: number;
  festival_adjustment_factor: number;
  event_notes: string[];
  suggested_purchase_quantity: number; // in kg or units
  recount_needed: boolean;
}

export class DemandForecastingService {
  /**
   * Calculate per-item rolling averages (7d, 30d, 90d) and day-of-week averages
   */
  public getItemSalesAnalytics(variantId: number): ItemSalesAnalytics | null {
    const variant = db.prepare(`
      SELECT pv.id, pv.variant_name, p.name as product_name, p.product_code, p.category, p.unit_type
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = ?
    `).get(variantId) as any;

    if (!variant) return null;

    const isWeight = variant.unit_type === 'weight';

    // Query sales volume for 7d, 30d, 90d
    const today = new Date();
    const getDateStr = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    const d7 = getDateStr(7);
    const d30 = getDateStr(30);
    const d90 = getDateStr(90);

    const calcAvg = (fromDate: string, daysCount: number) => {
      const row = db.prepare(`
        SELECT 
          SUM(COALESCE(ii.quantity_grams, 0)) as total_g,
          SUM(COALESCE(ii.quantity_units, 0)) as total_u
        FROM invoice_items ii
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE ii.product_variant_id = ? AND inv.status = 'completed' AND inv.created_at >= ?
      `).get(variantId, fromDate) as any;

      if (isWeight) {
        return Math.round(( (row?.total_g || 0) / 1000 / daysCount ) * 1000) / 1000;
      }
      return Math.round(( (row?.total_u || 0) / daysCount ) * 100) / 100;
    };

    const avg7d = calcAvg(d7, 7);
    const avg30d = calcAvg(d30, 30);
    const avg90d = calcAvg(d90, 90);

    // Calculate day-of-week averages (0=Sun, 1=Mon...6=Sat)
    const dowRows = db.prepare(`
      SELECT 
        CAST(strftime('%w', inv.created_at) AS INTEGER) as dow,
        SUM(COALESCE(ii.quantity_grams, 0)) as total_g,
        SUM(COALESCE(ii.quantity_units, 0)) as total_u,
        COUNT(DISTINCT DATE(inv.created_at)) as distinct_days
      FROM invoice_items ii
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE ii.product_variant_id = ? AND inv.status = 'completed' AND inv.created_at >= ?
      GROUP BY dow
    `).all(variantId, d90) as any[];

    const dowAverages: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    dowRows.forEach(r => {
      const count = Math.max(1, r.distinct_days);
      const val = isWeight ? (r.total_g / 1000 / count) : (r.total_u / count);
      dowAverages[r.dow] = Math.round(val * 1000) / 1000;
    });

    // Check data sufficiency: check total distinct days with completed invoices for this variant
    const historyRow = db.prepare(`
      SELECT COUNT(DISTINCT DATE(inv.created_at)) as cnt
      FROM invoice_items ii
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE ii.product_variant_id = ? AND inv.status = 'completed'
    `).get(variantId) as { cnt: number } | undefined;

    const totalDays = historyRow?.cnt || 0;
    const hasSufficientData = totalDays >= 7;

    // Fetch current stock from ledger
    const ledgerRow = db.prepare('SELECT quantity_grams, quantity_units FROM stock_ledger WHERE product_variant_id = ?').get(variantId) as any;
    const currentQty = isWeight ? (ledgerRow?.quantity_grams ?? 0) / 1000 : (ledgerRow?.quantity_units ?? 0);

    let daysStockLeft: number | null = null;
    let daysLeftStatus: ItemSalesAnalytics['days_left_status'] = 'no_data';

    if (hasSufficientData && avg30d > 0) {
      daysStockLeft = Math.round((currentQty / avg30d) * 10) / 10;
      if (daysStockLeft < 2) daysLeftStatus = 'urgent';
      else if (daysStockLeft < 4) daysLeftStatus = 'low';
      else daysLeftStatus = 'healthy';
    } else if (hasSufficientData && avg30d === 0) {
      daysLeftStatus = 'healthy'; // Stock exists but 0 sales
    }

    return {
      product_variant_id: variantId,
      product_name: variant.product_name,
      variant_name: variant.variant_name,
      product_code: variant.product_code,
      category: variant.category,
      unit_type: variant.unit_type,
      avg_daily_7d: avg7d,
      avg_daily_30d: avg30d,
      avg_daily_90d: avg90d,
      day_of_week_averages: dowAverages,
      has_sufficient_data: hasSufficientData,
      total_historical_days: totalDays,
      days_stock_left: daysStockLeft,
      days_left_status: daysLeftStatus,
    };
  }

  /**
   * Forecast demand for a specific target date
   */
  public forecastTargetDateDemand(variantId: number, targetDateStr: string): {
    forecasted_volume: number;
    base_avg_30d: number;
    dow_multiplier: number;
    festival_multiplier: number;
    event_name: string | null;
    bulk_order_qty: number;
    notes: string[];
  } {
    const analytics = this.getItemSalesAnalytics(variantId);
    const isWeight = analytics?.unit_type === 'weight';
    const baseAvg = analytics?.avg_daily_30d || 0;

    const targetDate = new Date(targetDateStr);
    const dow = targetDate.getDay(); // 0=Sunday

    // Calculate day-of-week multiplier relative to base 30d avg
    let dowMultiplier = 1.0;
    if (baseAvg > 0 && analytics?.day_of_week_averages[dow] !== undefined) {
      const dowAvg = analytics.day_of_week_averages[dow];
      if (dowAvg > 0) {
        dowMultiplier = Math.round((dowAvg / baseAvg) * 100) / 100;
      }
    }

    // Check festival / calendar events multiplier
    let festivalMultiplier = 1.0;
    let eventName: string | null = null;
    const notes: string[] = [];

    const event = db.prepare('SELECT * FROM calendar_events WHERE event_date = ?').get(targetDateStr) as CalendarEventRow | undefined;
    if (event) {
      eventName = event.event_name;
      if (event.impact_level === 'Very_Low') {
        festivalMultiplier = 0.3;
        notes.push(`Includes ${event.event_name} adjustment (0.3x strict fasting)`);
      } else if (event.impact_level === 'Low') {
        festivalMultiplier = 0.6;
        notes.push(`Includes ${event.event_name} adjustment (0.6x fasting day)`);
      } else if (event.impact_level === 'High') {
        festivalMultiplier = 1.4;
        notes.push(`Includes ${event.event_name} adjustment (1.4x festival spike)`);
      }
    }

    // Check registered pending bulk orders for target date
    const bulkRows = db.prepare(`
      SELECT quantity_grams, quantity_units, customer_name_or_notes
      FROM bulk_orders
      WHERE delivery_date = ? AND product_variant_id = ? AND status = 'pending'
    `).all(targetDateStr, variantId) as any[];

    let bulkOrderQty = 0;
    for (const b of bulkRows) {
      const bQty = isWeight ? (b.quantity_grams || 0) / 1000 : (b.quantity_units || 0);
      bulkOrderQty += bQty;
      notes.push(`Includes bulk order (${bQty}${isWeight ? 'kg' : 'pcs'}) for ${b.customer_name_or_notes}`);
    }

    const baselineDemand = baseAvg * dowMultiplier * festivalMultiplier;
    const finalForecastedVolume = Math.round((baselineDemand + bulkOrderQty) * 1000) / 1000;

    return {
      forecasted_volume: finalForecastedVolume,
      base_avg_30d: baseAvg,
      dow_multiplier: dowMultiplier,
      festival_multiplier: festivalMultiplier,
      event_name: eventName,
      bulk_order_qty: bulkOrderQty,
      notes,
    };
  }

  /**
   * Section 4: Purchasing Suggestions ("What to Buy")
   * Calculate 3-day forecasted demand + 1-day safety buffer - current stock
   */
  public getPurchasingSuggestions(): PurchasingSuggestion[] {
    const variants = db.prepare(`
      SELECT 
        pv.id,
        pv.variant_name,
        p.name as product_name,
        p.product_code,
        p.category,
        p.unit_type,
        pv.safety_threshold_grams,
        pv.safety_threshold_units,
        sl.quantity_grams,
        sl.quantity_units
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN stock_ledger sl ON sl.product_variant_id = pv.id
      WHERE p.is_active = 1 AND pv.is_active = 1
      ORDER BY p.category ASC, p.name ASC
    `).all() as any[];

    const suggestions: PurchasingSuggestion[] = [];
    const today = new Date();

    for (const v of variants) {
      const isWeight = v.unit_type === 'weight';
      const currentStock = isWeight ? (v.quantity_grams ?? 0) / 1000 : (v.quantity_units ?? 0);
      const safetyThreshold = isWeight ? (v.safety_threshold_grams ?? 5000) / 1000 : (v.safety_threshold_units ?? 10);

      // Forecast next 3 days
      let target3DayDemand = 0;
      let bulkAdditionsTotal = 0;
      const allNotesSet = new Set<string>();

      for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + dayOffset);
        const dStr = d.toISOString().split('T')[0];

        const f = this.forecastTargetDateDemand(v.id, dStr);
        target3DayDemand += f.forecasted_volume;
        bulkAdditionsTotal += f.bulk_order_qty;
        f.notes.forEach(n => allNotesSet.add(n));
      }

      const analytics = this.getItemSalesAnalytics(v.id);
      const avg30d = analytics?.avg_daily_30d || 0;
      const safetyBuffer = avg30d; // 1 day's average

      const neededGross = target3DayDemand + safetyBuffer;
      const suggestedQtyRaw = Math.max(0, neededGross - currentStock);
      const suggestedPurchaseQty = Math.round(suggestedQtyRaw * 10) / 10;

      // Suggest purchase if current stock is below threshold or stock will deplete within 3 days
      const isBelowThreshold = currentStock <= safetyThreshold;
      const WillDepleteSoon = (currentStock - target3DayDemand) <= 0;

      if (isBelowThreshold || WillDepleteSoon || suggestedPurchaseQty > 0) {
        suggestions.push({
          product_variant_id: v.id,
          product_name: v.product_name,
          variant_name: v.variant_name,
          product_code: v.product_code,
          category: v.category,
          unit_type: v.unit_type,
          current_stock: currentStock,
          safety_threshold: safetyThreshold,
          avg_daily_30d: avg30d,
          target_3day_forecast: Math.round(target3DayDemand * 10) / 10,
          safety_buffer: Math.round(safetyBuffer * 10) / 10,
          bulk_orders_addition: Math.round(bulkAdditionsTotal * 10) / 10,
          festival_adjustment_factor: 1.0,
          event_notes: Array.from(allNotesSet),
          suggested_purchase_quantity: suggestedPurchaseQty,
          recount_needed: currentStock <= 0 && (analytics?.has_sufficient_data ?? false),
        });
      }
    }

    return suggestions.sort((a, b) => b.suggested_purchase_quantity - a.suggested_purchase_quantity);
  }

  /**
   * Calendar Events CRUD & 7-day upcoming events banner list
   */
  public getUpcomingEvents(daysAhead = 7): CalendarEventRow[] {
    const todayStr = new Date().toISOString().split('T')[0];
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);
    const endStr = end.toISOString().split('T')[0];

    return db.prepare(`
      SELECT * FROM calendar_events
      WHERE event_date >= ? AND event_date <= ?
      ORDER BY event_date ASC
    `).all(todayStr, endStr) as CalendarEventRow[];
  }

  public listAllCalendarEvents(): CalendarEventRow[] {
    return db.prepare('SELECT * FROM calendar_events ORDER BY event_date ASC').all() as CalendarEventRow[];
  }

  public createCalendarEvent(input: { event_name: string; event_date: string; impact_level: 'High' | 'Normal' | 'Low' | 'Very_Low'; notes?: string }): CalendarEventRow {
    if (!input.event_name?.trim() || !input.event_date) {
      throw new ValidationError('Event name and date are required');
    }
    const res = db.prepare(`
      INSERT INTO calendar_events (event_name, event_date, impact_level, notes)
      VALUES (?, ?, ?, ?)
    `).run(input.event_name.trim(), input.event_date, input.impact_level, input.notes?.trim() || null);

    return db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(res.lastInsertRowid) as CalendarEventRow;
  }

  public deleteCalendarEvent(id: number): void {
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  }

  /**
   * Bulk Orders Management
   */
  public getPendingBulkOrders(): BulkOrderRow[] {
    const todayStr = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT bo.*, pv.variant_name, p.name as product_name, p.unit_type
      FROM bulk_orders bo
      JOIN product_variants pv ON pv.id = bo.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE bo.status = 'pending' AND bo.delivery_date >= ?
      ORDER BY bo.delivery_date ASC
    `).all(todayStr) as BulkOrderRow[];
  }

  public createBulkOrder(input: {
    delivery_date: string;
    product_variant_id: number;
    quantity: number;
    customer_name_or_notes: string;
  }, userId: number): BulkOrderRow {
    if (!input.delivery_date || !input.product_variant_id || !input.quantity || !input.customer_name_or_notes?.trim()) {
      throw new ValidationError('Delivery date, variant, quantity, and customer notes are mandatory');
    }

    const variant = db.prepare('SELECT unit_type FROM product_variants WHERE id = ?').get(input.product_variant_id) as any;
    if (!variant) throw new ValidationError('Invalid product variant');

    const isWeight = variant.unit_type === 'weight';
    const grams = isWeight ? Math.round(input.quantity * 1000) : null;
    const units = !isWeight ? Math.round(input.quantity) : null;

    const res = db.prepare(`
      INSERT INTO bulk_orders (
        delivery_date, product_variant_id, quantity_grams, quantity_units,
        customer_name_or_notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(input.delivery_date, input.product_variant_id, grams, units, input.customer_name_or_notes.trim(), userId);

    auditLogger.log(userId, 'BULK_ORDER_CREATED', {
      orderId: res.lastInsertRowid,
      deliveryDate: input.delivery_date,
      variantId: input.product_variant_id,
      quantity: input.quantity,
      customer: input.customer_name_or_notes,
    });

    return db.prepare('SELECT * FROM bulk_orders WHERE id = ?').get(res.lastInsertRowid) as BulkOrderRow;
  }

  public cancelBulkOrder(id: number, userId: number): void {
    db.prepare("UPDATE bulk_orders SET status = 'cancelled' WHERE id = ?").run(id);
    auditLogger.log(userId, 'BULK_ORDER_CANCELLED', { orderId: id });
  }
}

export const demandForecastingService = new DemandForecastingService();
export default demandForecastingService;
