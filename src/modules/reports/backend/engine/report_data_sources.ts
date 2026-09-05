import { DimensionDefinition, MeasureDefinition, GlobalFilterState } from '../../types/reports.types';

export interface DataSourceDefinition {
  id: string;
  name: string;
  description: string;
  dimensions: DimensionDefinition[];
  measures: MeasureDefinition[];
  getBaseQuery: (filters?: GlobalFilterState) => {
    fromClause: string;
    whereClause: string;
    params: any[];
  };
  getDataQualityWarnings: (filters?: GlobalFilterState) => { query: string; params: any[]; buildWarning: (row: any) => string | null };
}

// ============================================================================
// 1. MASTER SALES TRANSACTIONS DATA SOURCE
// ============================================================================
export const salesTransactionsDataSource: DataSourceDefinition = {
  id: 'sales_transactions',
  name: 'Sales Transactions',
  description: 'Line-item level sales data with invoice, customer, product, costing, and payment links',
  
  dimensions: [
    { id: 'invoice_id', name: 'Invoice ID', type: 'number', dbColumn: 'inv.id', filterable: true, sortable: true },
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number', filterable: true, sortable: true, groupable: true },
    { id: 'invoice_date', name: 'Date', type: 'date', dbColumn: "DATE(inv.completed_at)", filterable: true, sortable: true, groupable: true },
    { id: 'invoice_time', name: 'Time', type: 'string', dbColumn: "TIME(inv.completed_at)", filterable: false, sortable: true },
    { id: 'completed_at', name: 'Timestamp', type: 'datetime', dbColumn: 'inv.completed_at', filterable: true, sortable: true },
    { 
      id: 'day_of_week', 
      name: 'Day of Week', 
      type: 'string', 
      dbColumn: `CASE strftime('%w', inv.completed_at) 
        WHEN '0' THEN 'Sunday' 
        WHEN '1' THEN 'Monday' 
        WHEN '2' THEN 'Tuesday' 
        WHEN '3' THEN 'Wednesday' 
        WHEN '4' THEN 'Thursday' 
        WHEN '5' THEN 'Friday' 
        WHEN '6' THEN 'Saturday' 
      END`, 
      filterable: true, 
      sortable: true, 
      groupable: true 
    },
    { id: 'hour_of_day', name: 'Hour', type: 'string', dbColumn: "strftime('%H:00', inv.completed_at)", filterable: true, sortable: true, groupable: true },
    { id: 'month_year', name: 'Month', type: 'string', dbColumn: "strftime('%Y-%m', inv.completed_at)", filterable: true, sortable: true, groupable: true },
    { id: 'customer_id', name: 'Customer ID', type: 'number', dbColumn: 'inv.customer_id', filterable: true, sortable: true },
    { id: 'customer_name', name: 'Customer', type: 'string', dbColumn: "COALESCE(c.name, 'Walk-in Customer')", filterable: true, sortable: true, groupable: true },
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: "COALESCE(c.customer_code, 'WALKIN')", filterable: true, sortable: true },
    { id: 'customer_phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')", filterable: true, sortable: true },
    { id: 'customer_category', name: 'Customer Category', type: 'string', dbColumn: "COALESCE(c.category, 'Retail')", filterable: true, sortable: true, groupable: true },
    { id: 'product_id', name: 'Product ID', type: 'number', dbColumn: 'p.id', filterable: true, sortable: true },
    { id: 'product_name', name: 'Product', type: 'string', dbColumn: 'p.name', filterable: true, sortable: true, groupable: true },
    { id: 'sku', name: 'SKU', type: 'string', dbColumn: "COALESCE(p.product_code, '')", filterable: true, sortable: true },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name', filterable: true, sortable: true, groupable: true },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')", filterable: true, sortable: true, groupable: true },
    { id: 'subcategory', name: 'Subcategory', type: 'string', dbColumn: "COALESCE(p.subcategory, '')", filterable: true, sortable: true, groupable: true },
    { id: 'unit_type', name: 'Unit Type', type: 'string', dbColumn: 'p.unit_type', filterable: true, sortable: true, groupable: true },
    { id: 'payment_method', name: 'Payment Method', type: 'string', dbColumn: "COALESCE(pmt.method, CASE WHEN inv.payment_status = 'unpaid' THEN 'credit' ELSE 'cash' END)", filterable: true, sortable: true, groupable: true },
    { id: 'upi_reference', name: 'UPI Reference', type: 'string', dbColumn: "COALESCE(pmt.reference_number, '')", filterable: true, sortable: true },
    { id: 'cashier_name', name: 'Cashier', type: 'string', dbColumn: "COALESCE(u.username, 'Admin')", filterable: true, sortable: true, groupable: true },
    { id: 'cashier_id', name: 'Cashier ID', type: 'number', dbColumn: 'inv.created_by', filterable: true, sortable: true },
    { id: 'shift_id', name: 'Shift #', type: 'number', dbColumn: "COALESCE(inv.shift_id, 1)", filterable: true, sortable: true, groupable: true },
    { id: 'counter_id', name: 'Counter', type: 'string', dbColumn: "COALESCE(inv.counter_id, 'Counter 1')", filterable: true, sortable: true, groupable: true },
    { id: 'location_name', name: 'Location', type: 'string', dbColumn: "COALESCE(b.name, 'Main Store')", filterable: true, sortable: true, groupable: true },
    { id: 'location_id', name: 'Location ID', type: 'number', dbColumn: 'inv.location_id', filterable: true, sortable: true },
    { id: 'transaction_status', name: 'Status', type: 'string', dbColumn: 'inv.status', filterable: true, sortable: true },
    { id: 'payment_status', name: 'Payment Status', type: 'string', dbColumn: 'inv.payment_status', filterable: true, sortable: true, groupable: true },
    { id: 'discount_reason', name: 'Discount Reason', type: 'string', dbColumn: "COALESCE(inv.discount_reason, 'None')", filterable: true, sortable: true, groupable: true },
    { id: 'discount_percent', name: 'Discount %', type: 'number', dbColumn: "COALESCE(inv.discount_percent, 0)", filterable: true, sortable: true },
  ],

  measures: [
    { id: 'quantity', name: 'Quantity Units', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(ii.quantity_units, 0)' },
    { id: 'weight_grams', name: 'Weight (g)', type: 'weight', aggregation: 'sum', dbExpression: 'COALESCE(ii.quantity_grams, 0)' },
    { id: 'weight_kg', name: 'Weight (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(ii.quantity_grams, 0) / 1000.0, 3)' },
    { id: 'selling_price_paise', name: 'Selling Price (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'ii.rate_paise_snapshot' },
    { id: 'gross_amount_paise', name: 'Gross Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(ii.line_subtotal_paise + COALESCE(inv.discount_paise, 0))' },
    { id: 'discount_paise', name: 'Discount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv.discount_paise, 0)' },
    { id: 'taxable_amount_paise', name: 'Taxable Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_subtotal_paise' },
    { id: 'tax_paise', name: 'Tax (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(ii.line_total_paise - ii.line_subtotal_paise)' },
    { id: 'net_amount_paise', name: 'Net Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_total_paise' },
    { 
      id: 'cost_paise', 
      name: 'Cost (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        COALESCE(
          NULLIF(ii.real_cogs_paise, 0),
          NULLIF(ii.estimated_cogs_paise, 0),
          CASE 
            WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN 
              CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_grams) / 1000.0) AS INTEGER)
            WHEN p.unit_type = 'piece' AND ii.quantity_units > 0 THEN
              (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_units)
            ELSE 0
          END
        )
      ` 
    },
    { 
      id: 'gross_profit_paise', 
      name: 'Gross Profit (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        (ii.line_subtotal_paise - COALESCE(
          NULLIF(ii.real_cogs_paise, 0),
          NULLIF(ii.estimated_cogs_paise, 0),
          CASE 
            WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN 
              CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_grams) / 1000.0) AS INTEGER)
            WHEN p.unit_type = 'piece' AND ii.quantity_units > 0 THEN
              (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_units)
            ELSE 0
          END
        ))
      ` 
    },
    { 
      id: 'margin_percent', 
      name: 'Margin %', 
      type: 'percent', 
      aggregation: 'computed', 
      dbExpression: `
        ROUND(
          CAST(
            (ii.line_subtotal_paise - COALESCE(
              NULLIF(ii.real_cogs_paise, 0),
              NULLIF(ii.estimated_cogs_paise, 0),
              CASE 
                WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN 
                  CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_grams) / 1000.0) AS INTEGER)
                WHEN p.unit_type = 'piece' AND ii.quantity_units > 0 THEN
                  (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_units)
                ELSE 0
              END
            )) AS REAL
          ) / NULLIF(ii.line_subtotal_paise, 0) * 100.0, 
          2
        )
      ` 
    },
    // Meat shop specific unit economics
    { 
      id: 'cost_per_kg_paise', 
      name: 'Cost/kg (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN
            CAST(ROUND((COALESCE(NULLIF(ii.real_cogs_paise, 0), NULLIF(ii.estimated_cogs_paise, 0), (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_grams) / 1000.0, 0) * 1000.0) / ii.quantity_grams) AS INTEGER)
          ELSE COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0)
        END
      ` 
    },
    { 
      id: 'selling_price_per_kg_paise', 
      name: 'Price/kg (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN
            CAST(ROUND((ii.line_subtotal_paise * 1000.0) / ii.quantity_grams) AS INTEGER)
          ELSE ii.rate_paise_snapshot
        END
      ` 
    },
    { 
      id: 'profit_per_kg_paise', 
      name: 'Profit/kg (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' AND ii.quantity_grams > 0 THEN
            CAST(ROUND(((ii.line_subtotal_paise - COALESCE(NULLIF(ii.real_cogs_paise, 0), NULLIF(ii.estimated_cogs_paise, 0), (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * ii.quantity_grams) / 1000.0, 0)) * 1000.0) / ii.quantity_grams) AS INTEGER)
          ELSE (ii.rate_paise_snapshot - COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0))
        END
      ` 
    },
    { id: 'payment_amount_paise', name: 'Payment Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(pmt.amount_paise, inv.total_paise)' },
    { id: 'cash_collected_paise', name: 'Cash (₹)', type: 'currency', aggregation: 'sum', dbExpression: "CASE WHEN COALESCE(pmt.method, 'cash') = 'cash' THEN COALESCE(pmt.amount_paise, inv.total_paise) ELSE 0 END" },
    { id: 'upi_collected_paise', name: 'UPI (₹)', type: 'currency', aggregation: 'sum', dbExpression: "CASE WHEN pmt.method = 'upi' THEN COALESCE(pmt.amount_paise, inv.total_paise) ELSE 0 END" },
    { id: 'card_collected_paise', name: 'Card (₹)', type: 'currency', aggregation: 'sum', dbExpression: "CASE WHEN pmt.method = 'card' THEN COALESCE(pmt.amount_paise, inv.total_paise) ELSE 0 END" },
    { id: 'digital_collected_paise', name: 'Digital (₹)', type: 'currency', aggregation: 'sum', dbExpression: "CASE WHEN pmt.method IN ('upi', 'card') THEN COALESCE(pmt.amount_paise, inv.total_paise) ELSE 0 END" },
    { id: 'item_count', name: 'Item Rows', type: 'count', aggregation: 'count', dbExpression: 'ii.id' },
    { id: 'invoice_count', name: 'Invoices Count', type: 'count', aggregation: 'count_distinct', dbExpression: 'inv.id' },
    { id: 'avg_basket_value_paise', name: 'Avg Ticket (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'inv.total_paise' },
  ],

  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      JOIN product_variants pv ON ii.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN users u ON inv.created_by = u.id
      LEFT JOIN branches b ON inv.location_id = b.id
      LEFT JOIN (
        SELECT invoice_id, method, reference_number, SUM(amount_paise) as amount_paise
        FROM payments
        GROUP BY invoice_id
      ) pmt ON inv.id = pmt.invoice_id
    `;

    const whereConditions: string[] = ["inv.status = 'completed'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(inv.completed_at) >= DATE(?)");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(inv.completed_at) <= DATE(?)");
        params.push(filters.endDate);
      }
      if (filters.branchId && filters.branchId !== 'all') {
        whereConditions.push("inv.location_id = ?");
        params.push(filters.branchId);
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.productId && filters.productId !== 'all') {
        whereConditions.push("p.id = ?");
        params.push(filters.productId);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("inv.customer_id = ?");
        params.push(filters.customerId);
      }
      if (filters.customerCategory && filters.customerCategory !== 'all') {
        whereConditions.push("c.category = ?");
        params.push(filters.customerCategory);
      }
      if (filters.customerGroupId && filters.customerGroupId !== 'all') {
        whereConditions.push("c.group_id = ?");
        params.push(filters.customerGroupId);
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("inv.created_by = ?");
        params.push(filters.cashierId);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        whereConditions.push("COALESCE(pmt.method, CASE WHEN inv.payment_status = 'unpaid' THEN 'credit' ELSE 'cash' END) = ?");
        params.push(filters.paymentMethod);
      }
      if (filters.shiftId && filters.shiftId !== 'all') {
        whereConditions.push("inv.shift_id = ?");
        params.push(filters.shiftId);
      }
      if (filters.minAmountPaise !== undefined && filters.minAmountPaise > 0) {
        whereConditions.push("ii.line_total_paise >= ?");
        params.push(filters.minAmountPaise);
      }
      if (filters.maxAmountPaise !== undefined && filters.maxAmountPaise > 0) {
        whereConditions.push("ii.line_total_paise <= ?");
        params.push(filters.maxAmountPaise);
      }
      if (filters.minWeightGrams !== undefined && filters.minWeightGrams > 0) {
        whereConditions.push("ii.quantity_grams >= ?");
        params.push(filters.minWeightGrams);
      }
      if (filters.maxWeightGrams !== undefined && filters.maxWeightGrams > 0) {
        whereConditions.push("ii.quantity_grams <= ?");
        params.push(filters.maxWeightGrams);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push(`(
          inv.invoice_number LIKE ? OR
          c.name LIKE ? OR
          c.phone LIKE ? OR
          p.name LIKE ? OR
          p.product_code LIKE ? OR
          p.category LIKE ? OR
          u.username LIKE ?
        )`);
        params.push(term, term, term, term, term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: (filters?: GlobalFilterState) => {
    let whereClause = "WHERE inv.status = 'completed'";
    const params: any[] = [];
    if (filters?.startDate) {
      whereClause += " AND DATE(inv.completed_at) >= DATE(?)";
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      whereClause += " AND DATE(inv.completed_at) <= DATE(?)";
      params.push(filters.endDate);
    }

    const query = `
      SELECT 
        COUNT(CASE WHEN pv.last_purchase_cost = 0 AND pv.cost_price_paise_per_unit = 0 AND ii.real_cogs_paise = 0 THEN 1 END) as missing_cost_items,
        COUNT(CASE WHEN ii.real_cogs_paise = 0 AND (pv.cost_price_paise_per_unit > 0 OR pv.weighted_average_cost > 0) THEN 1 END) as estimated_cost_items
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      JOIN product_variants pv ON ii.product_variant_id = pv.id
      ${whereClause}
    `;

    return {
      query,
      params,
      buildWarning: (row: any) => {
        if (!row) return null;
        const missing = Number(row.missing_cost_items || 0);
        const estimated = Number(row.estimated_cost_items || 0);
        if (missing > 0) {
          return `⚠️ Data Quality Alert: ${missing} sold items have no purchase cost on record (profit may be overstated).`;
        }
        if (estimated > 0) {
          return `ℹ️ Notice: ${estimated} items use estimated base cost rather than linked batch purchase costs.`;
        }
        return null;
      }
    };
  }
};

// ============================================================================
// 2. SALES RETURNS DATA SOURCE
// ============================================================================
export const salesReturnsDataSource: DataSourceDefinition = {
  id: 'sales_returns',
  name: 'Sales Returns & Refunds',
  description: 'Customer returns, reasons, refund amounts, and replacement logs',

  dimensions: [
    { id: 'return_id', name: 'Return ID', type: 'number', dbColumn: 'sr.id', filterable: true, sortable: true },
    { id: 'return_number', name: 'Return #', type: 'string', dbColumn: 'sr.return_number', filterable: true, sortable: true, groupable: true },
    { id: 'invoice_id', name: 'Invoice ID', type: 'number', dbColumn: 'inv.id', filterable: true, sortable: true },
    { id: 'invoice_number', name: 'Original Invoice #', type: 'string', dbColumn: 'inv.invoice_number', filterable: true, sortable: true, groupable: true },
    { id: 'return_date', name: 'Return Date', type: 'date', dbColumn: 'DATE(sr.created_at)', filterable: true, sortable: true, groupable: true },
    { id: 'customer_name', name: 'Customer', type: 'string', dbColumn: "COALESCE(c.name, 'Walk-in Customer')", filterable: true, sortable: true, groupable: true },
    { id: 'product_name', name: 'Product', type: 'string', dbColumn: 'p.name', filterable: true, sortable: true, groupable: true },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name', filterable: true, sortable: true, groupable: true },
    { id: 'reason', name: 'Return Reason', type: 'string', dbColumn: 'sr.reason', filterable: true, sortable: true, groupable: true },
    { id: 'refund_method', name: 'Refund Method', type: 'string', dbColumn: 'sr.refund_method', filterable: true, sortable: true, groupable: true },
    { id: 'cashier_name', name: 'Processed By', type: 'string', dbColumn: "COALESCE(u.username, 'Admin')", filterable: true, sortable: true, groupable: true },
  ],

  measures: [
    { id: 'quantity', name: 'Returned Units', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(sri.quantity_units, 0)' },
    { id: 'weight_kg', name: 'Returned Weight (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(sri.quantity_grams, 0) / 1000.0, 3)' },
    { id: 'unit_rate_paise', name: 'Rate (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'sri.unit_rate_paise' },
    { id: 'refund_amount_paise', name: 'Refund Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'sri.refund_total_paise' },
    { id: 'return_count', name: 'Returns Count', type: 'count', aggregation: 'count_distinct', dbExpression: 'sr.id' },
  ],

  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM sales_returns sr
      JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      JOIN invoices inv ON sr.invoice_id = inv.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      JOIN product_variants pv ON sri.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN users u ON sr.processed_by = u.id
    `;

    const whereConditions: string[] = ["1 = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(sr.created_at) >= DATE(?)");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(sr.created_at) <= DATE(?)");
        params.push(filters.endDate);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("sr.customer_id = ?");
        params.push(filters.customerId);
      }
      if (filters.productId && filters.productId !== 'all') {
        whereConditions.push("p.id = ?");
        params.push(filters.productId);
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("sr.processed_by = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push(`(
          sr.return_number LIKE ? OR
          inv.invoice_number LIKE ? OR
          c.name LIKE ? OR
          p.name LIKE ? OR
          sr.reason LIKE ?
        )`);
        params.push(term, term, term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => {
    return {
      query: "SELECT COUNT(*) as cnt FROM sales_returns",
      params: [],
      buildWarning: () => null
    };
  }
};

// ============================================================================
// 3. PAYMENT RECORDS DATA SOURCE
// ============================================================================
export const paymentRecordsDataSource: DataSourceDefinition = {
  id: 'payment_records',
  name: 'Payment Records',
  description: 'Transaction-level payment entries across all methods',

  dimensions: [
    { id: 'payment_id', name: 'Payment ID', type: 'number', dbColumn: 'pmt.id', filterable: true, sortable: true },
    { id: 'invoice_id', name: 'Invoice ID', type: 'number', dbColumn: 'inv.id', filterable: true, sortable: true },
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number', filterable: true, sortable: true, groupable: true },
    { id: 'payment_date', name: 'Payment Date', type: 'date', dbColumn: 'DATE(pmt.received_at)', filterable: true, sortable: true, groupable: true },
    { id: 'payment_time', name: 'Payment Time', type: 'string', dbColumn: 'TIME(pmt.received_at)', filterable: false, sortable: true },
    { id: 'customer_name', name: 'Customer', type: 'string', dbColumn: "COALESCE(c.name, 'Walk-in Customer')", filterable: true, sortable: true, groupable: true },
    { id: 'customer_phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')", filterable: true, sortable: true },
    { id: 'payment_method', name: 'Payment Method', type: 'string', dbColumn: 'pmt.method', filterable: true, sortable: true, groupable: true },
    { id: 'reference_number', name: 'Reference / UTR', type: 'string', dbColumn: "COALESCE(pmt.reference_number, '')", filterable: true, sortable: true },
    { id: 'cashier_name', name: 'Cashier', type: 'string', dbColumn: "COALESCE(u.username, 'Admin')", filterable: true, sortable: true, groupable: true },
    { id: 'location_name', name: 'Branch', type: 'string', dbColumn: "COALESCE(b.name, 'Main Store')", filterable: true, sortable: true, groupable: true },
  ],

  measures: [
    { id: 'amount_paise', name: 'Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'pmt.amount_paise' },
    { id: 'payment_count', name: 'Payments Count', type: 'count', aggregation: 'count', dbExpression: 'pmt.id' },
  ],

  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM payments pmt
      JOIN invoices inv ON pmt.invoice_id = inv.id
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN users u ON inv.created_by = u.id
      LEFT JOIN branches b ON inv.location_id = b.id
    `;

    const whereConditions: string[] = ["inv.status = 'completed'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(pmt.received_at) >= DATE(?)");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(pmt.received_at) <= DATE(?)");
        params.push(filters.endDate);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        whereConditions.push("pmt.method = ?");
        params.push(filters.paymentMethod);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("inv.customer_id = ?");
        params.push(filters.customerId);
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("inv.created_by = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push(`(
          inv.invoice_number LIKE ? OR
          pmt.reference_number LIKE ? OR
          c.name LIKE ? OR
          c.phone LIKE ?
        )`);
        params.push(term, term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as count FROM payments WHERE method IS NULL",
    params: [],
    buildWarning: (row) => row?.count > 0 ? `⚠️ Found ${row.count} payments with unspecified payment method.` : null
  })
};

// ============================================================================
// 4. UPI RECONCILIATION DATA SOURCE
// ============================================================================
export const upiReconciliationDataSource: DataSourceDefinition = {
  id: 'upi_reconciliation',
  name: 'UPI Transactions & Reconciliation',
  description: 'UPI transaction tracking, customer matching, and gateway reconciliation status',

  dimensions: [
    { id: 'payment_id', name: 'Transaction ID', type: 'number', dbColumn: 'pmt.id', filterable: true, sortable: true },
    { id: 'upi_ref', name: 'UPI Reference / UTR', type: 'string', dbColumn: "COALESCE(pmt.reference_number, 'N/A')", filterable: true, sortable: true },
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number', filterable: true, sortable: true, groupable: true },
    { id: 'transaction_date', name: 'Date', type: 'date', dbColumn: 'DATE(pmt.received_at)', filterable: true, sortable: true, groupable: true },
    { id: 'transaction_time', name: 'Time', type: 'string', dbColumn: 'TIME(pmt.received_at)', filterable: false, sortable: true },
    { id: 'customer_name', name: 'Linked Customer', type: 'string', dbColumn: "COALESCE(c.name, 'Unlinked Payer')", filterable: true, sortable: true, groupable: true },
    { id: 'customer_phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')", filterable: true, sortable: true },
    { id: 'vpa', name: 'Matched VPA', type: 'string', dbColumn: "COALESCE(cui.vpa, 'N/A')", filterable: true, sortable: true },
    { 
      id: 'reconciliation_status', 
      name: 'Reconciliation Status', 
      type: 'string', 
      dbColumn: `CASE 
        WHEN cui.id IS NOT NULL AND cui.verified_count > 1 THEN 'Matched (Verified VPA)'
        WHEN cui.id IS NOT NULL THEN 'Matched'
        WHEN pmt.reference_number IS NOT NULL AND LENGTH(pmt.reference_number) > 4 THEN 'Manually Linked'
        ELSE 'Unmatched (No Gateway Data)'
      END`, 
      filterable: true, 
      sortable: true, 
      groupable: true 
    },
    { id: 'cashier_name', name: 'Cashier', type: 'string', dbColumn: "COALESCE(u.username, 'Admin')", filterable: true, sortable: true, groupable: true },
  ],

  measures: [
    { id: 'amount_paise', name: 'Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'pmt.amount_paise' },
    { id: 'transaction_count', name: 'Transactions Count', type: 'count', aggregation: 'count', dbExpression: 'pmt.id' },
  ],

  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM payments pmt
      JOIN invoices inv ON pmt.invoice_id = inv.id
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN customer_upi_identities cui ON c.id = cui.customer_id
      LEFT JOIN users u ON inv.created_by = u.id
    `;

    const whereConditions: string[] = ["pmt.method = 'upi'", "inv.status = 'completed'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(pmt.received_at) >= DATE(?)");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(pmt.received_at) <= DATE(?)");
        params.push(filters.endDate);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("inv.customer_id = ?");
        params.push(filters.customerId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push(`(
          inv.invoice_number LIKE ? OR
          pmt.reference_number LIKE ? OR
          c.name LIKE ? OR
          cui.vpa LIKE ?
        )`);
        params.push(term, term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unlinked FROM payments WHERE method = 'upi' AND (reference_number IS NULL OR reference_number = '')",
    params: [],
    buildWarning: (row) => row?.unlinked > 0 ? `⚠️ ${row.unlinked} UPI transactions have missing reference/UTR numbers.` : null
  })
};

// ============================================================================
// 5. COGS & INVENTORY VALUATION DATA SOURCE
// ============================================================================
export const cogsInventoryDataSource: DataSourceDefinition = {
  id: 'cogs_inventory',
  name: 'COGS & Inventory Valuation',
  description: 'Product cost prices, weighted average valuation, stock holding values, and costing methodologies',

  dimensions: [
    { id: 'product_id', name: 'Product ID', type: 'number', dbColumn: 'p.id', filterable: true, sortable: true },
    { id: 'product_name', name: 'Product', type: 'string', dbColumn: 'p.name', filterable: true, sortable: true, groupable: true },
    { id: 'sku', name: 'SKU', type: 'string', dbColumn: "COALESCE(p.product_code, '')", filterable: true, sortable: true },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name', filterable: true, sortable: true, groupable: true },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')", filterable: true, sortable: true, groupable: true },
    { id: 'unit_type', name: 'Unit Type', type: 'string', dbColumn: 'p.unit_type', filterable: true, sortable: true, groupable: true },
    { 
      id: 'costing_method', 
      name: 'Costing Method', 
      type: 'string', 
      dbColumn: `CASE 
        WHEN pv.weighted_average_cost > 0 THEN 'Actual Weighted Average (WAC)'
        WHEN pv.last_purchase_cost > 0 THEN 'Actual Last Purchase Cost'
        WHEN pv.cost_price_paise_per_unit > 0 THEN 'Estimated Base Cost'
        ELSE '⚠️ Cost Missing / Untracked'
      END`, 
      filterable: true, 
      sortable: true, 
      groupable: true 
    },
  ],

  measures: [
    { id: 'cost_price_paise_per_unit', name: 'Base Cost (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'pv.cost_price_paise_per_unit' },
    { id: 'last_purchase_cost_paise', name: 'Last Purchase Cost (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'pv.last_purchase_cost' },
    { id: 'weighted_average_cost_paise', name: 'WAC (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'pv.weighted_average_cost' },
    { id: 'selling_price_paise', name: 'Selling Price (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'pv.current_rate_paise_per_unit' },
    { 
      id: 'stock_weight_kg', 
      name: 'Stock on Hand (kg)', 
      type: 'weight', 
      aggregation: 'sum', 
      dbExpression: 'ROUND(COALESCE(psb.batch_weight_grams, 0) / 1000.0, 3)' 
    },
    { 
      id: 'stock_valuation_paise', 
      name: 'Stock Value (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' THEN 
            CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(psb.batch_weight_grams, 0)) / 1000.0) AS INTEGER)
          ELSE 
            (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(psb.batch_units, 0))
        END
      ` 
    },
  ],

  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN (
        SELECT product_variant_id, SUM(current_quantity_grams) as batch_weight_grams, SUM(current_quantity_units) as batch_units
        FROM product_stock_batches
        WHERE status = 'active'
        GROUP BY product_variant_id
      ) psb ON pv.id = psb.product_variant_id
    `;

    const whereConditions: string[] = ["pv.is_active = 1", "p.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.productId && filters.productId !== 'all') {
        whereConditions.push("p.id = ?");
        params.push(filters.productId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ? OR p.product_code LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as untracked FROM product_variants WHERE last_purchase_cost = 0 AND cost_price_paise_per_unit = 0 AND is_active = 1",
    params: [],
    buildWarning: (row) => row?.untracked > 0 ? `⚠️ ${row.untracked} active products have zero cost on record.` : null
  })
};

// ============================================================================
// Phase 3 Data Sources: Customer CRM, Credit & A/R, Advances
// ============================================================================

export const customerSalesIntelligenceDataSource: DataSourceDefinition = {
  id: 'customer_sales_intelligence',
  name: 'Customer CRM & Sales Intelligence',
  description: 'Customer profiles synchronized with Customer CRM Intelligence cache and invoice aggregates',
  dimensions: [
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: 'c.customer_code' },
    { id: 'customer_name', name: 'Customer Name', type: 'string', dbColumn: 'c.name' },
    { id: 'phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')" },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(c.category, 'Retail')" },
    { id: 'customer_segment', name: 'CRM Segment', type: 'string', dbColumn: "COALESCE(cac.segment, 'New')" },
    { id: 'first_visit_date', name: 'First Visit', type: 'date', dbColumn: "SUBSTR(COALESCE(inv_summary.first_invoice_at, ''), 1, 10)" },
    { id: 'last_visit_date', name: 'Last Visit', type: 'date', dbColumn: "SUBSTR(COALESCE(inv_summary.last_invoice_at, ''), 1, 10)" },
    { id: 'last_payment_date', name: 'Last Payment', type: 'date', dbColumn: "SUBSTR(COALESCE(pay_summary.last_payment_date, ''), 1, 10)" },
    { id: 'expected_next_visit', name: 'Expected Next Visit', type: 'date', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.expected_next_visit'), '')" },
    { id: 'payment_preference', name: 'Payment Preference', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.preferred_payment_method'), 'cash')" },
    { id: 'preferred_visit_day', name: 'Preferred Day', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.preferred_visit_day'), '')" },
    { id: 'purchase_frequency_label', name: 'Visit Frequency', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.purchase_frequency_label'), 'No Purchases')" },
    { id: 'reliability_rating', name: 'Payment Reliability', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.payment_reliability.rating'), 'N/A')" },
    { id: 'favorite_products_summary', name: 'Favorite Products', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.typical_basket_summary'), '')" },
  ],
  measures: [
    { id: 'total_orders', name: 'Orders Count', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(inv_summary.total_invoices_count, 0)' },
    { id: 'total_revenue_paise', name: 'Total Revenue (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv_summary.total_invoiced_paise, 0)' },
    { id: 'total_weight_kg', name: 'Total Weight (kg)', type: 'weight', aggregation: 'sum', dbExpression: "ROUND(COALESCE(json_extract(cac.metrics_json, '$.total_weight_grams'), 0) / 1000.0, 3)" },
    { id: 'avg_bill_paise', name: 'Average Bill (₹)', type: 'currency', aggregation: 'avg', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.average_bill_paise'), 0)" },
    { id: 'avg_visit_interval_days', name: 'Avg Interval (Days)', type: 'number', aggregation: 'avg', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.average_visit_interval'), 0)" },
    { id: 'days_since_last_visit', name: 'Days Since Last Visit', type: 'number', aggregation: 'avg', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.days_since_last_purchase'), 0)" },
    { id: 'days_overdue', name: 'Days Overdue', type: 'number', aggregation: 'avg', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.days_overdue'), 0)" },
    { id: 'clv_paise', name: 'Customer Lifetime Value (₹)', type: 'currency', aggregation: 'sum', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.customer_lifetime_value_paise'), inv_summary.total_invoiced_paise, 0)" },
    { id: 'credit_limit_paise', name: 'Credit Limit (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.credit_limit_paise, 0)' },
    { id: 'outstanding_balance_paise', name: 'Outstanding (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.outstanding_balance_paise, 0)' },
    { id: 'advance_balance_paise', name: 'Advance Balance (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.advance_balance_paise, 0)' },
    { id: 'customer_count', name: 'Customers Count', type: 'count', aggregation: 'count', dbExpression: 'c.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM customers c
      LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
      LEFT JOIN (
        SELECT customer_id,
               COUNT(id) as total_invoices_count,
               MIN(completed_at) as first_invoice_at,
               MAX(completed_at) as last_invoice_at,
               SUM(total_paise) as total_invoiced_paise
        FROM invoices
        WHERE status = 'completed'
        GROUP BY customer_id
      ) inv_summary ON c.id = inv_summary.customer_id
      LEFT JOIN (
        SELECT customer_id,
               MAX(payment_date) as last_payment_date
        FROM customer_payment_records
        GROUP BY customer_id
      ) pay_summary ON c.id = pay_summary.customer_id
    `;

    const whereConditions: string[] = ["c.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.customerCategory && filters.customerCategory !== 'all') {
        whereConditions.push("c.category = ?");
        params.push(filters.customerCategory);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("c.id = ?");
        params.push(filters.customerId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unsegmented FROM customers WHERE id NOT IN (SELECT customer_id FROM customer_analytics_cache)",
    params: [],
    buildWarning: (row) => row?.unsegmented > 0 ? `ℹ️ ${row.unsegmented} customers are awaiting initial intelligence sync.` : null
  })
};

export const arOutstandingInvoicesDataSource: DataSourceDefinition = {
  id: 'ar_outstanding_invoices',
  name: 'A/R Outstanding Invoices',
  description: 'Itemized outstanding invoices synchronized with live payment allocations',
  dimensions: [
    { id: 'invoice_number', name: 'Invoice Number', type: 'string', dbColumn: 'inv.invoice_number' },
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: 'c.customer_code' },
    { id: 'customer_name', name: 'Customer Name', type: 'string', dbColumn: 'c.name' },
    { id: 'phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')" },
    { id: 'category', name: 'Customer Category', type: 'string', dbColumn: "COALESCE(c.category, 'Retail')" },
    { id: 'invoice_date', name: 'Invoice Date', type: 'date', dbColumn: "SUBSTR(inv.completed_at, 1, 10)" },
    { id: 'due_date', name: 'Due Date', type: 'date', dbColumn: "DATE(inv.completed_at, '+15 days')" },
    { id: 'payment_status', name: 'Payment Status', type: 'string', dbColumn: 'inv.payment_status' },
  ],
  measures: [
    { id: 'original_amount_paise', name: 'Original Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'inv.total_paise' },
    { id: 'paid_amount_paise', name: 'Paid Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(COALESCE(pmt.direct_paid_paise, 0) + COALESCE(cpa.allocated_paise, 0))' },
    { id: 'outstanding_amount_paise', name: 'Outstanding (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(inv.total_paise - COALESCE(pmt.direct_paid_paise, 0) - COALESCE(cpa.allocated_paise, 0))' },
    { id: 'days_overdue', name: 'Days Overdue', type: 'number', aggregation: 'max', dbExpression: "MAX(0, CAST(JULIANDAY('now') - JULIANDAY(inv.completed_at) AS INTEGER))" },
    { id: 'credit_limit_paise', name: 'Credit Limit (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.credit_limit_paise, 0)' },
    { id: 'invoice_count', name: 'Invoices Count', type: 'count', aggregation: 'count', dbExpression: 'inv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_paise) as direct_paid_paise
        FROM payments
        GROUP BY invoice_id
      ) pmt ON inv.id = pmt.invoice_id
      LEFT JOIN (
        SELECT invoice_id, SUM(allocated_paise) as allocated_paise
        FROM customer_payment_allocations
        GROUP BY invoice_id
      ) cpa ON inv.id = cpa.invoice_id
    `;

    const whereConditions: string[] = [
      "inv.status = 'completed'",
      "inv.payment_status IN ('unpaid', 'partial')",
      "(inv.total_paise - COALESCE(pmt.direct_paid_paise, 0) - COALESCE(cpa.allocated_paise, 0)) > 0"
    ];
    const params: any[] = [];

    if (filters) {
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("c.id = ?");
        params.push(filters.customerId);
      }
      if (filters.customerCategory && filters.customerCategory !== 'all') {
        whereConditions.push("c.category = ?");
        params.push(filters.customerCategory);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(inv.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as overdue_count FROM invoices WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial') AND CAST(JULIANDAY('now') - JULIANDAY(completed_at) AS INTEGER) > 60",
    params: [],
    buildWarning: (row) => row?.overdue_count > 0 ? `⚠️ ${row.overdue_count} invoices are severely overdue (>60 days).` : null
  })
};

export const arAgingSummaryDataSource: DataSourceDefinition = {
  id: 'ar_aging_summary',
  name: 'A/R Aging Schedule Summary',
  description: 'Customer outstanding aging buckets synchronized with Credit & A/R aging module',
  dimensions: [
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: 'c.customer_code' },
    { id: 'customer_name', name: 'Customer Name', type: 'string', dbColumn: 'c.name' },
    { id: 'phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')" },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(c.category, 'Retail')" },
    { 
      id: 'risk_level', 
      name: 'Risk Level', 
      type: 'string', 
      dbColumn: "CASE WHEN cca.is_blacklisted = 1 OR cca.is_frozen = 1 OR COALESCE(inv_b3.b3_paise, 0) > 0 THEN 'High' WHEN COALESCE(inv_b2.b2_paise, 0) > 0 OR COALESCE(inv_b1.b1_paise, 0) > 0 THEN 'Medium' ELSE 'Low' END" 
    },
    {
      id: 'credit_status',
      name: 'Credit Status',
      type: 'string',
      dbColumn: "CASE WHEN cca.is_blacklisted = 1 THEN 'Blacklisted' WHEN cca.is_frozen = 1 THEN 'Frozen' ELSE 'Active' END"
    }
  ],
  measures: [
    { id: 'current_bucket_paise', name: '0–15 Days (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv_b0.b0_paise, 0)' },
    { id: 'bucket_1_paise', name: '16–30 Days (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv_b1.b1_paise, 0)' },
    { id: 'bucket_2_paise', name: '31–60 Days (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv_b2.b2_paise, 0)' },
    { id: 'bucket_3_paise', name: '60+ Days (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(inv_b3.b3_paise, 0)' },
    { id: 'total_outstanding_paise', name: 'Total Outstanding (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.outstanding_balance_paise, 0)' },
    { id: 'credit_limit_paise', name: 'Credit Limit (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.credit_limit_paise, 0)' },
    { id: 'available_credit_paise', name: 'Available Credit (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'MAX(0, COALESCE(c.credit_limit_paise, 0) - COALESCE(c.outstanding_balance_paise, 0))' },
    { id: 'customer_count', name: 'Customers Count', type: 'count', aggregation: 'count', dbExpression: 'c.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM customers c
      LEFT JOIN customer_credit_accounts cca ON c.id = cca.customer_id
      LEFT JOIN (
        SELECT customer_id, 
               SUM(total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as b0_paise
        FROM invoices
        WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')
          AND CAST(JULIANDAY('now') - JULIANDAY(completed_at) AS INTEGER) <= 15
        GROUP BY customer_id
      ) inv_b0 ON c.id = inv_b0.customer_id
      LEFT JOIN (
        SELECT customer_id, 
               SUM(total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as b1_paise
        FROM invoices
        WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')
          AND CAST(JULIANDAY('now') - JULIANDAY(completed_at) AS INTEGER) BETWEEN 16 AND 30
        GROUP BY customer_id
      ) inv_b1 ON c.id = inv_b1.customer_id
      LEFT JOIN (
        SELECT customer_id, 
               SUM(total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as b2_paise
        FROM invoices
        WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')
          AND CAST(JULIANDAY('now') - JULIANDAY(completed_at) AS INTEGER) BETWEEN 31 AND 60
        GROUP BY customer_id
      ) inv_b2 ON c.id = inv_b2.customer_id
      LEFT JOIN (
        SELECT customer_id, 
               SUM(total_paise - COALESCE((SELECT SUM(amount_paise) FROM payments WHERE invoice_id = invoices.id), 0) - COALESCE((SELECT SUM(allocated_paise) FROM customer_payment_allocations WHERE invoice_id = invoices.id), 0)) as b3_paise
        FROM invoices
        WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')
          AND CAST(JULIANDAY('now') - JULIANDAY(completed_at) AS INTEGER) > 60
        GROUP BY customer_id
      ) inv_b3 ON c.id = inv_b3.customer_id
    `;

    const whereConditions: string[] = ["(c.outstanding_balance_paise > 0 OR c.credit_allowed = 1)"];
    const params: any[] = [];

    if (filters) {
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("c.id = ?");
        params.push(filters.customerId);
      }
      if (filters.customerCategory && filters.customerCategory !== 'all') {
        whereConditions.push("c.category = ?");
        params.push(filters.customerCategory);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as frozen_count FROM customer_credit_accounts WHERE is_frozen = 1 OR is_blacklisted = 1",
    params: [],
    buildWarning: (row) => row?.frozen_count > 0 ? `⚠️ ${row.frozen_count} customer credit accounts are currently frozen or blacklisted.` : null
  })
};

export const customerPaymentBehaviorDataSource: DataSourceDefinition = {
  id: 'customer_payment_behavior',
  name: 'Customer Payment Behavior & Reliability',
  description: 'Credit collection metrics, payment delay days, and reliability ratings per customer',
  dimensions: [
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: 'c.customer_code' },
    { id: 'customer_name', name: 'Customer Name', type: 'string', dbColumn: 'c.name' },
    { id: 'phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')" },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(c.category, 'Retail')" },
    { id: 'reliability_rating', name: 'Reliability Rating', type: 'string', dbColumn: "COALESCE(json_extract(cac.metrics_json, '$.payment_reliability.rating'), 'Good')" },
  ],
  measures: [
    { id: 'total_credit_invoices', name: 'Credit Invoices Count', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(cr_inv.total_credit_invoices, 0)' },
    { id: 'total_credit_sales_paise', name: 'Total Credit Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(cr_inv.total_credit_sales_paise, 0)' },
    { id: 'total_collections_paise', name: 'Total Collections (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(pay.total_collections_paise, 0)' },
    { id: 'current_balance_paise', name: 'Current Outstanding (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(c.outstanding_balance_paise, 0)' },
    { id: 'avg_days_to_pay', name: 'Avg Payment Delay (Days)', type: 'number', aggregation: 'avg', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.payment_reliability.avg_days_to_pay'), 0)" },
    { id: 'late_payments_count', name: 'Late Payments Count', type: 'number', aggregation: 'sum', dbExpression: "COALESCE(json_extract(cac.metrics_json, '$.payment_reliability.total_late_payments'), 0)" },
    { id: 'customer_count', name: 'Customers Count', type: 'count', aggregation: 'count', dbExpression: 'c.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM customers c
      LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
      LEFT JOIN (
        SELECT customer_id,
               COUNT(id) as total_credit_invoices,
               SUM(total_paise) as total_credit_sales_paise
        FROM invoices
        WHERE status = 'completed' AND (payment_status IN ('unpaid', 'partial') OR id IN (SELECT invoice_id FROM customer_payment_allocations WHERE invoice_id IS NOT NULL))
        GROUP BY customer_id
      ) cr_inv ON c.id = cr_inv.customer_id
      LEFT JOIN (
        SELECT customer_id,
               COUNT(id) as total_payments_count,
               SUM(amount_paise) as total_collections_paise
        FROM customer_payment_records
        GROUP BY customer_id
      ) pay ON c.id = pay.customer_id
    `;

    const whereConditions: string[] = ["(c.credit_allowed = 1 OR c.outstanding_balance_paise > 0 OR COALESCE(cr_inv.total_credit_invoices, 0) > 0)"];
    const params: any[] = [];

    if (filters) {
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("c.id = ?");
        params.push(filters.customerId);
      }
      if (filters.customerCategory && filters.customerCategory !== 'all') {
        whereConditions.push("c.category = ?");
        params.push(filters.customerCategory);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as poor_rating FROM customer_analytics_cache WHERE json_extract(metrics_json, '$.payment_reliability.rating') = 'Poor'",
    params: [],
    buildWarning: (row) => row?.poor_rating > 0 ? `⚠️ ${row.poor_rating} customers have Poor credit payment reliability.` : null
  })
};

export const customerAdvancesDataSource: DataSourceDefinition = {
  id: 'customer_advances',
  name: 'Customer Advances & Deposits',
  description: 'Customer advance deposits, usage allocations, and remaining balances',
  dimensions: [
    { id: 'deposit_date', name: 'Deposit Date', type: 'date', dbColumn: 'cap.deposit_date' },
    { id: 'customer_code', name: 'Customer Code', type: 'string', dbColumn: 'c.customer_code' },
    { id: 'customer_name', name: 'Customer Name', type: 'string', dbColumn: 'c.name' },
    { id: 'phone', name: 'Phone', type: 'string', dbColumn: "COALESCE(c.phone, '')" },
    { id: 'method', name: 'Payment Method', type: 'string', dbColumn: 'cap.method' },
    { id: 'reference_number', name: 'Ref / Note', type: 'string', dbColumn: "COALESCE(cap.reference_number, '')" },
    { 
      id: 'status', 
      name: 'Status', 
      type: 'string', 
      dbColumn: "CASE WHEN cap.remaining_paise = 0 THEN 'Exhausted' WHEN cap.remaining_paise < cap.amount_paise THEN 'Partially Used' ELSE 'Available' END" 
    },
    { id: 'notes', name: 'Notes', type: 'string', dbColumn: "COALESCE(cap.notes, '')" },
  ],
  measures: [
    { id: 'deposit_amount_paise', name: 'Deposit Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'cap.amount_paise' },
    { id: 'used_amount_paise', name: 'Used / Applied (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(cap.amount_paise - cap.remaining_paise)' },
    { id: 'remaining_balance_paise', name: 'Remaining Balance (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'cap.remaining_paise' },
    { id: 'deposit_count', name: 'Deposits Count', type: 'count', aggregation: 'count', dbExpression: 'cap.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM customer_advance_payments cap
      JOIN customers c ON cap.customer_id = c.id
      LEFT JOIN users u ON cap.created_by = u.id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("cap.deposit_date >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("cap.deposit_date <= ?");
        params.push(filters.endDate);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        whereConditions.push("c.id = ?");
        params.push(filters.customerId);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        whereConditions.push("cap.method = ?");
        params.push(filters.paymentMethod);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(c.name LIKE ? OR c.phone LIKE ? OR cap.reference_number LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as active_advances FROM customer_advance_payments WHERE remaining_paise > 0",
    params: [],
    buildWarning: (row) => null
  })
};

// ============================================================================
// Phase 4 Data Sources: Inventory, Meat Yield, Wastage, Purchases & Suppliers
// ============================================================================

export const stockOnHandDataSource: DataSourceDefinition = {
  id: 'stock_on_hand',
  name: 'Stock on Hand (Batches & Items)',
  description: 'Current active batch inventory with stock quantities, weights, unit costs, and valuations',
  dimensions: [
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'sku', name: 'SKU / Barcode', type: 'string', dbColumn: "COALESCE(p.product_code, pv.barcode, '')" },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'batch_number', name: 'Batch Number', type: 'string', dbColumn: "COALESCE(psb.batch_number, 'DIRECT-STOCK')" },
    { id: 'unit_type', name: 'Unit Type', type: 'string', dbColumn: 'p.unit_type' },
    { id: 'received_date', name: 'Received Date', type: 'date', dbColumn: "SUBSTR(COALESCE(psb.received_date, psb.created_at, p.created_at), 1, 10)" },
    { id: 'batch_status', name: 'Batch Status', type: 'string', dbColumn: "COALESCE(psb.status, 'active')" },
  ],
  measures: [
    { 
      id: 'stock_quantity', 
      name: 'Stock Quantity', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN ROUND(COALESCE(psb.current_quantity_grams, sl.quantity_grams, 0) / 1000.0, 3) ELSE COALESCE(psb.current_quantity_units, sl.quantity_units, 0) END" 
    },
    { 
      id: 'weight_kg', 
      name: 'Weight (kg)', 
      type: 'weight', 
      aggregation: 'sum', 
      dbExpression: "ROUND(COALESCE(psb.current_quantity_grams, sl.quantity_grams, 0) / 1000.0, 3)" 
    },
    { 
      id: 'units_count', 
      name: 'Units Count', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "COALESCE(psb.current_quantity_units, sl.quantity_units, 0)" 
    },
    { 
      id: 'unit_cost_paise', 
      name: 'Unit Cost (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: "COALESCE(NULLIF(psb.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0)" 
    },
    { 
      id: 'stock_valuation_paise', 
      name: 'Stock Value (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN 
            CAST(ROUND((COALESCE(NULLIF(psb.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(psb.current_quantity_grams, sl.quantity_grams, 0)) / 1000.0) AS INTEGER)
          ELSE 
            (COALESCE(NULLIF(psb.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(psb.current_quantity_units, sl.quantity_units, 0))
        END
      ` 
    },
    { id: 'batches_count', name: 'Batches Count', type: 'count', aggregation: 'count', dbExpression: 'pv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN product_stock_batches psb ON pv.id = psb.product_variant_id AND psb.status = 'active'
      LEFT JOIN stock_ledger sl ON pv.id = sl.product_variant_id
    `;

    const whereConditions: string[] = ["pv.is_active = 1", "p.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.productId && filters.productId !== 'all') {
        whereConditions.push("p.id = ?");
        params.push(filters.productId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ? OR psb.batch_number LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as zero_cost FROM product_variants WHERE is_active = 1 AND cost_price_paise_per_unit = 0 AND last_purchase_cost = 0",
    params: [],
    buildWarning: (row) => row?.zero_cost > 0 ? `⚠️ ${row.zero_cost} active variants have zero cost recorded.` : null
  })
};

export const inventoryMovementLedgerDataSource: DataSourceDefinition = {
  id: 'inventory_movement_ledger',
  name: 'Inventory Movement Ledger',
  description: 'Inflows and outflows directly sourced from inventory_ledger entries grouped by product',
  dimensions: [
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'unit_type', name: 'Unit Type', type: 'string', dbColumn: 'p.unit_type' },
  ],
  measures: [
    { 
      id: 'purchases_qty', 
      name: 'Purchases (+)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type = 'purchase' THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'transfers_in_qty', 
      name: 'Transfers In (+)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type IN ('transfer_in', 'fridge_removal', 'yield_in') THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'returns_qty', 
      name: 'Returns (+)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type = 'return' THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'sales_qty', 
      name: 'Sales (-)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type = 'sale' THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'transfers_out_qty', 
      name: 'Transfers Out (-)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type IN ('transfer_out', 'fridge_deposit', 'yield_out') THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'wastage_qty', 
      name: 'Wastage (-)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type = 'wastage' THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'adjustments_qty', 
      name: 'Adjustments (+/-)', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN il.action_type = 'audit_adjustment' THEN (CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN COALESCE(il.quantity_grams, 0) / 1000.0 ELSE COALESCE(il.quantity_units, 0) END) ELSE 0 END" 
    },
    { 
      id: 'closing_stock_qty', 
      name: 'Closing Stock', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN ROUND(COALESCE(sl.quantity_grams, 0) / 1000.0, 3) ELSE COALESCE(sl.quantity_units, 0) END" 
    },
    { 
      id: 'closing_valuation_paise', 
      name: 'Closing Value (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN 
            CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(sl.quantity_grams, 0)) / 1000.0) AS INTEGER)
          ELSE 
            (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(sl.quantity_units, 0))
        END
      ` 
    },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN inventory_ledger il ON pv.id = il.product_variant_id
      LEFT JOIN stock_ledger sl ON pv.id = sl.product_variant_id
    `;

    const whereConditions: string[] = ["pv.is_active = 1", "p.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("(il.created_at IS NULL OR il.created_at >= ?)");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("(il.created_at IS NULL OR il.created_at <= ?)");
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.productId && filters.productId !== 'all') {
        whereConditions.push("p.id = ?");
        params.push(filters.productId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ?)");
        params.push(term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unlinked FROM inventory_ledger WHERE product_variant_id NOT IN (SELECT id FROM product_variants)",
    params: [],
    buildWarning: (row) => row?.unlinked > 0 ? `⚠️ ${row.unlinked} inventory ledger entries reference missing variants.` : null
  })
};

export const meatYieldProcessingDataSource: DataSourceDefinition = {
  id: 'meat_yield_processing',
  name: 'Meat Processing & Yield Runs',
  description: 'Carcass deboning and butchery yields, comparing Realized Saleable Meat % vs Expected Yield ratio',
  dimensions: [
    { id: 'run_number', name: 'Run Number', type: 'string', dbColumn: 'ypr.run_number' },
    { id: 'run_date', name: 'Date', type: 'date', dbColumn: "SUBSTR(ypr.created_at, 1, 10)" },
    { id: 'raw_product_name', name: 'Raw Material', type: 'string', dbColumn: 'raw_p.name' },
    { id: 'raw_variant_name', name: 'Raw Variant', type: 'string', dbColumn: 'raw_pv.variant_name' },
    { id: 'processed_by', name: 'Butcher / Staff', type: 'string', dbColumn: "COALESCE(u.full_name, u.username, 'Staff')" },
    { id: 'notes', name: 'Notes', type: 'string', dbColumn: "COALESCE(ypr.notes, '')" },
  ],
  measures: [
    { id: 'input_weight_kg', name: 'Input Received (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(ypr.input_quantity_grams, 0) / 1000.0, 3)' },
    { id: 'input_cost_paise', name: 'Input Cost (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ypr.total_input_cost_paise' },
    { id: 'saleable_output_weight_kg', name: 'Saleable Cuts (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(out_summary.total_output_grams, 0) / 1000.0, 3)' },
    { id: 'saleable_output_cost_paise', name: 'Allocated Value (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(out_summary.total_output_cost_paise, 0)' },
    { id: 'waste_weight_kg', name: 'Bone/Trim/Waste (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(ypr.wastage_quantity_grams, 0) / 1000.0, 3)' },
    { 
      id: 'actual_yield_percent', 
      name: 'Actual Yield %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'ROUND((COALESCE(out_summary.total_output_grams, 0) * 100.0) / NULLIF(ypr.input_quantity_grams, 0), 2)' 
    },
    { 
      id: 'expected_yield_percent', 
      name: 'Expected Yield %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'COALESCE(raw_pv.yield_ratio, 80.0)' 
    },
    { 
      id: 'yield_variance_percent', 
      name: 'Variance %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'ROUND(((COALESCE(out_summary.total_output_grams, 0) * 100.0) / NULLIF(ypr.input_quantity_grams, 0)) - COALESCE(raw_pv.yield_ratio, 80.0), 2)' 
    },
    { id: 'runs_count', name: 'Processing Runs', type: 'count', aggregation: 'count', dbExpression: 'ypr.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM yield_processing_runs ypr
      JOIN product_variants raw_pv ON ypr.raw_input_variant_id = raw_pv.id
      JOIN products raw_p ON raw_pv.product_id = raw_p.id
      LEFT JOIN users u ON ypr.processed_by = u.id
      LEFT JOIN (
        SELECT yield_run_id, 
               SUM(output_quantity_grams) as total_output_grams,
               SUM(allocated_cost_paise) as total_output_cost_paise
        FROM yield_processing_outputs
        GROUP BY yield_run_id
      ) out_summary ON ypr.id = out_summary.yield_run_id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("ypr.created_at >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("ypr.created_at <= ?");
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(ypr.run_number LIKE ? OR raw_p.name LIKE ? OR raw_pv.variant_name LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as low_yield FROM yield_processing_runs ypr LEFT JOIN (SELECT yield_run_id, SUM(output_quantity_grams) as total_out FROM yield_processing_outputs GROUP BY yield_run_id) out ON ypr.id = out.yield_run_id WHERE (COALESCE(out.total_out, 0) * 100.0 / NULLIF(ypr.input_quantity_grams, 0)) < 60.0",
    params: [],
    buildWarning: (row) => row?.low_yield > 0 ? `⚠️ ${row.low_yield} yield processing runs had abnormally low yield (<60%).` : null
  })
};

export const inventoryWastageLossDataSource: DataSourceDefinition = {
  id: 'inventory_wastage_loss',
  name: 'Inventory Wastage, Spoilage & Loss',
  description: 'Spoilage, cutting loss, and discard entries logged in inventory_ledger with cost impact',
  dimensions: [
    { id: 'wastage_date', name: 'Date', type: 'date', dbColumn: "SUBSTR(il.created_at, 1, 10)" },
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'reason', name: 'Loss Reason', type: 'string', dbColumn: "COALESCE(sa.reason, il.notes, 'Spoilage / Trim Loss')" },
    { id: 'logged_by', name: 'Logged By', type: 'string', dbColumn: "COALESCE(u.full_name, u.username, 'Staff')" },
    { id: 'reference_number', name: 'Ref / Note', type: 'string', dbColumn: "COALESCE(il.reference_number, '')" },
  ],
  measures: [
    { id: 'wastage_weight_kg', name: 'Wastage Weight (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(il.quantity_grams, 0) / 1000.0, 3)' },
    { id: 'wastage_units', name: 'Wastage Units', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(il.quantity_units, 0)' },
    { id: 'unit_cost_paise', name: 'Unit Cost (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'COALESCE(NULLIF(il.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0)' },
    { 
      id: 'total_loss_paise', 
      name: 'Total Loss (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN 
            CAST(ROUND((COALESCE(NULLIF(il.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(il.quantity_grams, 0)) / 1000.0) AS INTEGER)
          ELSE 
            (COALESCE(NULLIF(il.unit_cost_paise, 0), NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(il.quantity_units, 0))
        END
      ` 
    },
    { id: 'incident_count', name: 'Wastage Events', type: 'count', aggregation: 'count', dbExpression: 'il.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM inventory_ledger il
      JOIN product_variants pv ON il.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN users u ON il.created_by = u.id
      LEFT JOIN stock_adjustments sa ON (il.reference_type = 'stock_adjustment' AND il.reference_id = sa.id)
    `;

    const whereConditions: string[] = ["il.action_type = 'wastage'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("il.created_at >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("il.created_at <= ?");
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ? OR sa.reason LIKE ? OR il.notes LIKE ?)");
        params.push(term, term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as recent_wastage FROM inventory_ledger WHERE action_type = 'wastage' AND created_at >= date('now', '-7 days')",
    params: [],
    buildWarning: (row) => row?.recent_wastage > 5 ? `ℹ️ ${row.recent_wastage} wastage incidents logged in the past 7 days.` : null
  })
};

export const deadStockAnalysisDataSource: DataSourceDefinition = {
  id: 'dead_stock_analysis',
  name: 'Dead Stock & Slow-Moving Products',
  description: 'Identifies inventory sitting idle with no sales beyond configurable threshold days and suggested actions',
  dimensions: [
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'sku', name: 'SKU', type: 'string', dbColumn: "COALESCE(p.product_code, pv.barcode, '')" },
    { id: 'last_sale_date', name: 'Last Sale Date', type: 'date', dbColumn: "SUBSTR(COALESCE(last_sale.last_sold_at, ''), 1, 10)" },
    { 
      id: 'recommended_action', 
      name: 'Recommended Action', 
      type: 'string', 
      dbColumn: "CASE WHEN last_sale.last_sold_at IS NULL THEN 'Review Cut / Intro Promotion' WHEN CAST(JULIANDAY('now') - JULIANDAY(last_sale.last_sold_at) AS INTEGER) >= 60 THEN 'Urgent Clearance / Deep Markdown' WHEN CAST(JULIANDAY('now') - JULIANDAY(last_sale.last_sold_at) AS INTEGER) >= 30 THEN 'Promotional Bundle / Discount' ELSE 'Monitor Sales Velocity' END" 
    },
  ],
  measures: [
    { 
      id: 'current_stock_qty', 
      name: 'Current Stock', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN ROUND(COALESCE(sl.quantity_grams, 0) / 1000.0, 3) ELSE COALESCE(sl.quantity_units, 0) END" 
    },
    { 
      id: 'stock_value_paise', 
      name: 'Stock Value (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: `
        CASE 
          WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN 
            CAST(ROUND((COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(sl.quantity_grams, 0)) / 1000.0) AS INTEGER)
          ELSE 
            (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * COALESCE(sl.quantity_units, 0))
        END
      ` 
    },
    { 
      id: 'days_without_sale', 
      name: 'Days Without Sale', 
      type: 'number', 
      aggregation: 'max', 
      dbExpression: "CASE WHEN last_sale.last_sold_at IS NULL THEN 999 ELSE MAX(0, CAST(JULIANDAY('now') - JULIANDAY(last_sale.last_sold_at) AS INTEGER)) END" 
    },
    { id: 'dead_items_count', name: 'Items Count', type: 'count', aggregation: 'count', dbExpression: 'pv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      JOIN stock_ledger sl ON pv.id = sl.product_variant_id
      LEFT JOIN (
        SELECT ii.product_variant_id, MAX(i.completed_at) as last_sold_at
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.status = 'completed'
        GROUP BY ii.product_variant_id
      ) last_sale ON pv.id = last_sale.product_variant_id
    `;

    const whereConditions: string[] = [
      "pv.is_active = 1",
      "p.is_active = 1",
      "(sl.quantity_grams > 0 OR sl.quantity_units > 0)"
    ];
    const params: any[] = [];

    if (filters) {
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ?)");
        params.push(term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as high_idle FROM product_variants pv JOIN stock_ledger sl ON pv.id = sl.product_variant_id LEFT JOIN (SELECT product_variant_id, MAX(i.completed_at) as last_sold FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.status = 'completed' GROUP BY product_variant_id) ls ON pv.id = ls.product_variant_id WHERE pv.is_active = 1 AND (sl.quantity_grams > 0 OR sl.quantity_units > 0) AND (ls.last_sold IS NULL OR CAST(JULIANDAY('now') - JULIANDAY(ls.last_sold) AS INTEGER) > 30)",
    params: [],
    buildWarning: (row) => row?.high_idle > 0 ? `⚠️ ${row.high_idle} products have stock on hand with no sales in >30 days.` : null
  })
};

export const purchaseTransactionsDataSource: DataSourceDefinition = {
  id: 'purchase_transactions',
  name: 'Purchase Transactions & Procurement',
  description: 'Detailed purchase transactions and supplier shipments with quantities and costs',
  dimensions: [
    { id: 'purchase_date', name: 'Date', type: 'date', dbColumn: "SUBSTR(pur.created_at, 1, 10)" },
    { id: 'supplier_name', name: 'Supplier', type: 'string', dbColumn: "COALESCE(s.company_name, s.name, 'Supplier')" },
    { id: 'supplier_code', name: 'Supplier Code', type: 'string', dbColumn: 's.code' },
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'logged_by', name: 'Received By', type: 'string', dbColumn: "COALESCE(u.full_name, u.username, 'Admin')" },
  ],
  measures: [
    { 
      id: 'purchase_quantity', 
      name: 'Purchased Qty', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN ROUND(COALESCE(pur.quantity_grams, 0) / 1000.0, 3) ELSE COALESCE(pur.quantity_units, 0) END" 
    },
    { 
      id: 'purchase_weight_kg', 
      name: 'Weight (kg)', 
      type: 'weight', 
      aggregation: 'sum', 
      dbExpression: "ROUND(COALESCE(pur.quantity_grams, 0) / 1000.0, 3)" 
    },
    { id: 'purchase_cost_paise', name: 'Total Cost (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'pur.cost_paise' },
    { 
      id: 'unit_cost_paise', 
      name: 'Unit Cost (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: "CASE WHEN (p.unit_type = 'weight' OR p.unit_type = 'live_dual') AND COALESCE(pur.quantity_grams, 0) > 0 THEN CAST(ROUND((pur.cost_paise * 1000.0) / pur.quantity_grams) AS INTEGER) WHEN COALESCE(pur.quantity_units, 0) > 0 THEN CAST(ROUND(pur.cost_paise / pur.quantity_units) AS INTEGER) ELSE pur.cost_paise END" 
    },
    { id: 'purchase_count', name: 'Purchases Count', type: 'count', aggregation: 'count', dbExpression: 'pur.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM purchases pur
      JOIN suppliers s ON pur.supplier_id = s.id
      JOIN product_variants pv ON pur.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN users u ON pur.created_by = u.id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("pur.created_at >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("pur.created_at <= ?");
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(s.company_name LIKE ? OR s.code LIKE ? OR p.name LIKE ? OR pv.variant_name LIKE ?)");
        params.push(term, term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as zero_cost FROM purchases WHERE cost_paise = 0",
    params: [],
    buildWarning: (row) => row?.zero_cost > 0 ? `⚠️ ${row.zero_cost} purchase records have ₹0 total cost.` : null
  })
};

export const supplierProcurementSummaryDataSource: DataSourceDefinition = {
  id: 'supplier_procurement_summary',
  name: 'Supplier Procurement & Payables',
  description: 'Supplier purchasing frequency, procurement spend, and outstanding payables matching Supplier Ledger',
  dimensions: [
    { id: 'supplier_code', name: 'Supplier Code', type: 'string', dbColumn: 's.code' },
    { id: 'supplier_name', name: 'Supplier Name', type: 'string', dbColumn: "COALESCE(s.company_name, s.name, 'Supplier')" },
    { id: 'contact', name: 'Contact', type: 'string', dbColumn: "COALESCE(s.phone, s.contact, '')" },
    { id: 'last_purchase_date', name: 'Last Purchase Date', type: 'date', dbColumn: "SUBSTR(COALESCE(pur_stats.last_purchased_at, ''), 1, 10)" },
  ],
  measures: [
    { id: 'total_purchases_count', name: 'Total Orders', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(pur_stats.total_orders, 0)' },
    { id: 'total_weight_kg', name: 'Total Weight (kg)', type: 'weight', aggregation: 'sum', dbExpression: 'ROUND(COALESCE(pur_stats.total_grams, 0) / 1000.0, 3)' },
    { id: 'total_spend_paise', name: 'Total Spend (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(pur_stats.total_cost_paise, 0)' },
    { 
      id: 'avg_order_cost_paise', 
      name: 'Avg Order (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: 'CASE WHEN COALESCE(pur_stats.total_orders, 0) > 0 THEN CAST(ROUND(pur_stats.total_cost_paise / pur_stats.total_orders) AS INTEGER) ELSE 0 END' 
    },
    { 
      id: 'outstanding_payable_paise', 
      name: 'Outstanding Payable (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: "COALESCE(s.outstanding_balance_paise, (SELECT COALESCE(SUM(outstanding_amount_paise), 0) FROM purchase_invoices WHERE supplier_id = s.id AND payment_status != 'paid'), 0)" 
    },
    { id: 'supplier_count', name: 'Suppliers Count', type: 'count', aggregation: 'count', dbExpression: 's.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id,
               COUNT(id) as total_orders,
               SUM(quantity_grams) as total_grams,
               SUM(cost_paise) as total_cost_paise,
               MAX(created_at) as last_purchased_at
        FROM purchases
        GROUP BY supplier_id
      ) pur_stats ON s.id = pur_stats.supplier_id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(s.company_name LIKE ? OR s.code LIKE ? OR s.phone LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unpaid_invoices FROM purchase_invoices WHERE payment_status = 'unpaid' AND outstanding_amount_paise > 0",
    params: [],
    buildWarning: (row) => row?.unpaid_invoices > 0 ? `ℹ️ ${row.unpaid_invoices} supplier purchase bills are currently unpaid.` : null
  })
};

export const purchaseCostVarianceDataSource: DataSourceDefinition = {
  id: 'purchase_cost_variance',
  name: 'Purchase Price Variance & Margin Impact',
  description: 'Tracks purchase price changes, percentage cost increases, and their direct impact on selling margins',
  dimensions: [
    { id: 'product_name', name: 'Product Name', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
    { id: 'unit_type', name: 'Unit Type', type: 'string', dbColumn: 'p.unit_type' },
    { 
      id: 'cost_trend', 
      name: 'Cost Trend', 
      type: 'string', 
      dbColumn: "CASE WHEN pv.last_purchase_cost > pv.cost_price_paise_per_unit THEN 'Increased 🔺' WHEN pv.last_purchase_cost < pv.cost_price_paise_per_unit AND pv.last_purchase_cost > 0 THEN 'Decreased 🔻' ELSE 'Stable' END" 
    },
  ],
  measures: [
    { id: 'current_purchase_cost_paise', name: 'Current Cost (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'COALESCE(NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0)' },
    { id: 'previous_purchase_cost_paise', name: 'Base / Prev Cost (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'COALESCE(pv.cost_price_paise_per_unit, 0)' },
    { 
      id: 'cost_difference_paise', 
      name: 'Variance (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: '(COALESCE(NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) - COALESCE(pv.cost_price_paise_per_unit, 0))' 
    },
    { 
      id: 'cost_change_percent', 
      name: 'Cost Change %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'ROUND(((COALESCE(NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) - COALESCE(pv.cost_price_paise_per_unit, 0)) * 100.0) / NULLIF(pv.cost_price_paise_per_unit, 0), 2)' 
    },
    { id: 'selling_price_paise', name: 'Selling Price (₹)', type: 'currency', aggregation: 'avg', dbExpression: 'pv.current_rate_paise_per_unit' },
    { 
      id: 'margin_after_increase_percent', 
      name: 'Effective Margin %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'ROUND(((pv.current_rate_paise_per_unit - COALESCE(NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0)) * 100.0) / NULLIF(pv.current_rate_paise_per_unit, 0), 2)' 
    },
    { id: 'items_count', name: 'Products Count', type: 'count', aggregation: 'count', dbExpression: 'pv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
    `;

    const whereConditions: string[] = ["pv.is_active = 1", "p.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ?)");
        params.push(term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as margin_erosion FROM product_variants pv WHERE pv.is_active = 1 AND pv.last_purchase_cost > 0 AND pv.last_purchase_cost > pv.current_rate_paise_per_unit",
    params: [],
    buildWarning: (row) => row?.margin_erosion > 0 ? `🚨 ${row.margin_erosion} products have purchase costs exceeding their selling prices!` : null
  })
};

// ============================================================================
// Phase 5 Data Sources: Expenses, Cash & Shifts, Employees, Audit, Tax & Business Performance
// ============================================================================

export const expenseRecordsDataSource: DataSourceDefinition = {
  id: 'expense_records',
  name: 'Expense Records & Spending',
  description: 'Itemized operational store expenses categorized with payment methods, vendors, and receipts',
  dimensions: [
    { id: 'expense_id', name: 'Expense ID', type: 'number', dbColumn: 'exp.id' },
    { id: 'expense_date', name: 'Date', type: 'date', dbColumn: 'exp.expense_date' },
    { id: 'category_name', name: 'Category', type: 'string', dbColumn: "COALESCE(ec.name, 'Miscellaneous')" },
    { id: 'vendor_name', name: 'Vendor / Payee', type: 'string', dbColumn: "COALESCE(exp.vendor_name, '')" },
    { id: 'payment_method', name: 'Payment Method', type: 'string', dbColumn: "COALESCE(exp.payment_method, 'Cash')" },
    { id: 'status', name: 'Status', type: 'string', dbColumn: 'exp.status' },
    { id: 'notes', name: 'Description / Notes', type: 'string', dbColumn: "COALESCE(exp.notes, '')" },
    { id: 'logged_by', name: 'Logged By', type: 'string', dbColumn: "COALESCE(u.full_name, u.username, 'Admin')" },
  ],
  measures: [
    { id: 'amount_paise', name: 'Total Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'exp.amount_paise' },
    { id: 'gst_paise', name: 'GST (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(exp.gst_paise, 0)' },
    { id: 'net_amount_paise', name: 'Net Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(exp.amount_paise - COALESCE(exp.gst_paise, 0))' },
    { id: 'expenses_count', name: 'Expenses Count', type: 'count', aggregation: 'count', dbExpression: 'exp.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM expenses exp
      LEFT JOIN expense_categories ec ON exp.category_id = ec.id
      LEFT JOIN users u ON exp.created_by = u.id
    `;

    const whereConditions: string[] = ["exp.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("exp.expense_date >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("exp.expense_date <= ?");
        params.push(filters.endDate);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        whereConditions.push("exp.payment_method = ?");
        params.push(filters.paymentMethod);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(ec.name LIKE ? OR exp.vendor_name LIKE ? OR exp.notes LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unapproved FROM expenses WHERE is_active = 1 AND status = 'Pending'",
    params: [],
    buildWarning: (row) => row?.unapproved > 0 ? `ℹ️ ${row.unapproved} expense entries are pending manager approval.` : null
  })
};

export const cashBoxShiftsDataSource: DataSourceDefinition = {
  id: 'cash_box_shifts',
  name: 'Cash Box & Shift Closings',
  description: 'Shift register audit comparing Opening Cash, Sales, Inflows, Outflows, Expected Cash vs Physical Count',
  dimensions: [
    { id: 'session_id', name: 'Shift ID', type: 'number', dbColumn: 'ps.id' },
    { id: 'employee_name', name: 'Cashier / Staff', type: 'string', dbColumn: "COALESCE(u.full_name, u.username, 'Cashier')" },
    { id: 'start_time', name: 'Start Time', type: 'datetime', dbColumn: 'ps.opened_at' },
    { id: 'end_time', name: 'End Time', type: 'datetime', dbColumn: "COALESCE(ps.closed_at, 'Active')" },
    { id: 'shift_date', name: 'Date', type: 'date', dbColumn: "SUBSTR(ps.opened_at, 1, 10)" },
    { id: 'reconciliation_status', name: 'Status', type: 'string', dbColumn: "COALESCE(scr.status, CASE WHEN ps.status = 'closed' THEN 'closed' ELSE 'open' END)" },
    { id: 'variance_reason', name: 'Declared Reason', type: 'string', dbColumn: "COALESCE(scr.declared_reason, ps.variance_reason, '')" },
  ],
  measures: [
    { id: 'opening_cash_paise', name: 'Opening Cash (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ps.opening_cash_paise' },
    { id: 'cash_sales_paise', name: 'Cash Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: "COALESCE((SELECT SUM(amount_paise) FROM store_cash_box WHERE session_id = ps.id AND type = 'CASH_SALE' AND is_active = 1), 0)" },
    { id: 'upi_sales_paise', name: 'UPI Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: "0" },
    { id: 'card_sales_paise', name: 'Card Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: "0" },
    { id: 'credit_sales_paise', name: 'Credit Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: "0" },
    { id: 'cash_in_paise', name: 'Cash In / Receipts (₹)', type: 'currency', aggregation: 'sum', dbExpression: "COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'cash_in' AND is_active = 1), 0)" },
    { id: 'cash_out_paise', name: 'Withdrawals (₹)', type: 'currency', aggregation: 'sum', dbExpression: "COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'cash_out' AND is_active = 1), 0)" },
    { id: 'expenses_paise', name: 'Shop Expenses (₹)', type: 'currency', aggregation: 'sum', dbExpression: "COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'expense' AND is_active = 1), 0)" },
    { 
      id: 'expected_cash_paise', 
      name: 'Expected Cash (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: 'COALESCE(scr.expected_cash_paise, ps.expected_cash_paise, ps.opening_cash_paise)' 
    },
    { id: 'actual_cash_paise', name: 'Counted Cash (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(scr.physical_cash_paise, ps.closing_cash_paise, 0)' },
    { 
      id: 'variance_paise', 
      name: 'Variance (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: 'COALESCE(scr.difference_paise, ps.variance_paise, 0)' 
    },
    { id: 'shifts_count', name: 'Shifts Count', type: 'count', aggregation: 'count', dbExpression: 'ps.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM pos_sessions ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      LEFT JOIN shift_closing_records scr ON ps.id = scr.session_id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("ps.opened_at >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("ps.opened_at <= ?");
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("ps.cashier_id = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(u.username LIKE ? OR u.full_name LIKE ? OR scr.declared_reason LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as high_var FROM shift_closing_records WHERE ABS(difference_paise) > 50000",
    params: [],
    buildWarning: (row) => row?.high_var > 0 ? `⚠️ ${row.high_var} shifts recorded cash variance exceeding ₹500.` : null
  })
};

export const employeeCashierPerformanceDataSource: DataSourceDefinition = {
  id: 'employee_cashier_performance',
  name: 'Employee & Cashier Performance',
  description: 'Individual employee sales volume, collections, discounts, returns, credit sales, and void accountability',
  dimensions: [
    { id: 'employee_id', name: 'Employee ID', type: 'number', dbColumn: 'u.id' },
    { id: 'cashier_name', name: 'Cashier / Employee', type: 'string', dbColumn: "COALESCE(u.full_name, u.username)" },
    { id: 'role', name: 'Role', type: 'string', dbColumn: 'u.role' },
  ],
  measures: [
    { id: 'total_sales_paise', name: 'Total Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_sales.total_net_paise, 0)' },
    { id: 'invoices_count', name: 'Invoices Billed', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(emp_sales.invoices_count, 0)' },
    { 
      id: 'avg_invoice_paise', 
      name: 'Avg Ticket (₹)', 
      type: 'currency', 
      aggregation: 'avg', 
      dbExpression: 'CASE WHEN COALESCE(emp_sales.invoices_count, 0) > 0 THEN CAST(ROUND(emp_sales.total_net_paise / emp_sales.invoices_count) AS INTEGER) ELSE 0 END' 
    },
    { id: 'discounts_given_paise', name: 'Discounts Given (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_sales.discounts_paise, 0)' },
    { id: 'cash_collected_paise', name: 'Cash Collected (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_pay.cash_paise, 0)' },
    { id: 'upi_collected_paise', name: 'UPI Collected (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_pay.upi_paise, 0)' },
    { id: 'credit_sales_paise', name: 'Credit Allowed (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_sales.credit_paise, 0)' },
    { id: 'returns_count', name: 'Returns Count', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(emp_ret.returns_count, 0)' },
    { id: 'refunds_paise', name: 'Refunds Processed (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'COALESCE(emp_ret.refunds_paise, 0)' },
    { id: 'voids_count', name: 'Voided Invoices', type: 'number', aggregation: 'sum', dbExpression: 'COALESCE(emp_voids.void_count, 0)' },
    { id: 'employees_count', name: 'Staff Count', type: 'count', aggregation: 'count', dbExpression: 'u.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM users u
      LEFT JOIN (
        SELECT 
          created_by,
          COUNT(id) as invoices_count,
          SUM(total_paise) as total_net_paise,
          SUM(CASE WHEN payment_status = 'unpaid' OR payment_status = 'partial' THEN (total_paise - COALESCE(p_sum.paid, 0)) ELSE 0 END) as credit_paise,
          0 as discounts_paise
        FROM invoices i
        LEFT JOIN (SELECT invoice_id, SUM(amount_paise) as paid FROM payments GROUP BY invoice_id) p_sum ON i.id = p_sum.invoice_id
        WHERE i.status = 'completed'
        GROUP BY created_by
      ) emp_sales ON u.id = emp_sales.created_by
      LEFT JOIN (
        SELECT 
          i.created_by,
          SUM(CASE WHEN p.method = 'cash' THEN p.amount_paise ELSE 0 END) as cash_paise,
          SUM(CASE WHEN p.method = 'upi' THEN p.amount_paise ELSE 0 END) as upi_paise
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        GROUP BY i.created_by
      ) emp_pay ON u.id = emp_pay.created_by
      LEFT JOIN (
        SELECT 
          processed_by,
          COUNT(id) as returns_count,
          SUM(total_refund_paise) as refunds_paise
        FROM sales_returns
        GROUP BY processed_by
      ) emp_ret ON u.id = emp_ret.processed_by
      LEFT JOIN (
        SELECT 
          created_by,
          COUNT(id) as void_count
        FROM invoices
        WHERE status IN ('void', 'cancelled')
        GROUP BY created_by
      ) emp_voids ON u.id = emp_voids.created_by
    `;

    const whereConditions: string[] = ["u.is_active = 1"];
    const params: any[] = [];

    if (filters) {
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("u.id = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(u.username LIKE ? OR u.full_name LIKE ?)");
        params.push(term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as high_voids FROM invoices WHERE status IN ('void', 'cancelled') AND created_at >= date('now', '-7 days')",
    params: [],
    buildWarning: (row) => row?.high_voids > 5 ? `ℹ️ ${row.high_voids} voided/cancelled transactions in the past 7 days.` : null
  })
};

export const voidCancelledTransactionsDataSource: DataSourceDefinition = {
  id: 'void_cancelled_transactions',
  name: 'Void & Cancelled Invoices',
  description: 'Dedicated audit trail of cancelled, voided, and aborted transactions with reasons and manager approvals',
  dimensions: [
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number' },
    { id: 'cancellation_date', name: 'Date', type: 'date', dbColumn: "DATE(COALESCE(inv.voided_at, inv.created_at))" },
    { id: 'cancellation_time', name: 'Time', type: 'string', dbColumn: "TIME(COALESCE(inv.voided_at, inv.created_at))" },
    { id: 'cashier_name', name: 'Cashier', type: 'string', dbColumn: "COALESCE(u_created.full_name, u_created.username, 'Cashier')" },
    { id: 'approved_by', name: 'Approved By', type: 'string', dbColumn: "COALESCE(u_app.full_name, u_app.username, 'Admin')" },
    { id: 'customer_name', name: 'Customer', type: 'string', dbColumn: "COALESCE(c.name, 'Walk-in')" },
    { id: 'cancellation_reason', name: 'Cancellation Reason', type: 'string', dbColumn: "COALESCE(inv.void_reason, inv.gst_number_snapshot, 'Voided by Cashier / Customer Request')" },
    { id: 'status', name: 'Status', type: 'string', dbColumn: 'inv.status' },
  ],
  measures: [
    { id: 'void_amount_paise', name: 'Void Amount (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'inv.total_paise' },
    { id: 'void_count', name: 'Void Transactions', type: 'count', aggregation: 'count', dbExpression: 'inv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM invoices inv
      LEFT JOIN users u_created ON inv.created_by = u_created.id
      LEFT JOIN users u_app ON inv.voided_by = u_app.id
      LEFT JOIN customers c ON inv.customer_id = c.id
    `;

    const whereConditions: string[] = ["inv.status IN ('void', 'cancelled')"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(inv.created_at) >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(inv.created_at) <= ?");
        params.push(filters.endDate);
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("inv.created_by = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(inv.invoice_number LIKE ? OR inv.void_reason LIKE ? OR c.name LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as cnt FROM invoices WHERE status IN ('void', 'cancelled')",
    params: [],
    buildWarning: (row) => null
  })
};

export const unifiedAuditTrailDataSource: DataSourceDefinition = {
  id: 'unified_audit_trail',
  name: 'Unified System Audit Trail',
  description: 'Aggregates audit events across Product Tracking Changes, Purchase Reversals, HR Logs, and Shift Closings',
  dimensions: [
    { id: 'audit_date', name: 'Date', type: 'date', dbColumn: "SUBSTR(ua.created_at, 1, 10)" },
    { id: 'audit_time', name: 'Time', type: 'string', dbColumn: "SUBSTR(ua.created_at, 12, 8)" },
    { id: 'module_entity', name: 'Module / Subsystem', type: 'string', dbColumn: 'ua.entity_type' },
    { id: 'action_type', name: 'Action', type: 'string', dbColumn: 'ua.action' },
    { id: 'user_name', name: 'User / Actor', type: 'string', dbColumn: "COALESCE(ua.user_name, 'System')" },
    { id: 'reason', name: 'Reason / Change', type: 'string', dbColumn: "COALESCE(ua.reason, 'Administrative Action')" },
    { id: 'details', name: 'Details / State', type: 'string', dbColumn: "COALESCE(ua.details, '')" },
  ],
  measures: [
    { id: 'audit_events_count', name: 'Audit Events', type: 'count', aggregation: 'count', dbExpression: 'ua.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM (
        SELECT 
          id,
          'Product Tracking' as entity_type,
          'Tracking Mode Changed' as action,
          COALESCE(changed_by_name, 'Admin') as user_name,
          reason,
          ('Old: ' || old_track_in_inventory || ', New: ' || new_track_in_inventory) as details,
          created_at
        FROM product_tracking_change_log

        UNION ALL

        SELECT 
          id,
          'HR & Payroll' as entity_type,
          action,
          COALESCE(performed_by_name, 'HR Admin') as user_name,
          reason,
          ('Entity #' || entity_id || ' ' || entity_type) as details,
          created_at
        FROM hr_audit_logs

        UNION ALL

        SELECT 
          id,
          module as entity_type,
          action,
          username as user_name,
          description as reason,
          ('Action on ' || module) as details,
          created_at
        FROM enterprise_audit_logs

        UNION ALL

        SELECT 
          id,
          'Security & Core' as entity_type,
          action,
          'Admin' as user_name,
          'System Security Log' as reason,
          details,
          created_at
        FROM audit_logs
      ) ua
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("SUBSTR(ua.created_at, 1, 10) >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("SUBSTR(ua.created_at, 1, 10) <= ?");
        params.push(filters.endDate);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(ua.entity_type LIKE ? OR ua.action LIKE ? OR ua.reason LIKE ? OR ua.user_name LIKE ?)");
        params.push(term, term, term, term);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as cnt FROM audit_logs",
    params: [],
    buildWarning: (row) => null
  })
};

export const taxGstBreakdownDataSource: DataSourceDefinition = {
  id: 'tax_gst_breakdown',
  name: 'Tax / GST Summary & Invoices',
  description: 'Itemized and invoice-level GST breakdown (Taxable, CGST, SGST, IGST, Exempt) dynamically reading product tax rates',
  dimensions: [
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number' },
    { id: 'invoice_date', name: 'Date', type: 'date', dbColumn: 'DATE(inv.completed_at)' },
    { id: 'product_name', name: 'Product', type: 'string', dbColumn: 'p.name' },
    { id: 'variant_name', name: 'Variant', type: 'string', dbColumn: 'pv.variant_name' },
    { id: 'tax_rate_percent', name: 'Tax Rate %', type: 'number', dbColumn: 'ROUND(COALESCE(ii.gst_rate_percent_snapshot, 0) / 100.0, 2)' },
    { 
      id: 'is_exempt', 
      name: 'Tax Treatment', 
      type: 'string', 
      dbColumn: "CASE WHEN COALESCE(ii.gst_rate_percent_snapshot, 0) = 0 THEN 'Exempt' ELSE 'Taxable' END" 
    },
  ],
  measures: [
    { id: 'taxable_amount_paise', name: 'Taxable Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_subtotal_paise' },
    { id: 'cgst_paise', name: 'CGST (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'CAST(ROUND(COALESCE(ii.line_tax_paise, 0) / 2.0) AS INTEGER)' },
    { id: 'sgst_paise', name: 'SGST (₹)', type: 'currency', aggregation: 'sum', dbExpression: '(COALESCE(ii.line_tax_paise, 0) - CAST(ROUND(COALESCE(ii.line_tax_paise, 0) / 2.0) AS INTEGER))' },
    { id: 'igst_paise', name: 'IGST (₹)', type: 'currency', aggregation: 'sum', dbExpression: '0' },
    { id: 'total_tax_paise', name: 'Total Tax (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_tax_paise' },
    { id: 'total_invoice_amount_paise', name: 'Total Invoiced (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_total_paise' },
    { id: 'items_count', name: 'Items Count', type: 'count', aggregation: 'count', dbExpression: 'ii.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      JOIN product_variants pv ON ii.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
    `;

    const whereConditions: string[] = ["inv.status = 'completed'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(inv.completed_at) >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(inv.completed_at) <= ?");
        params.push(filters.endDate);
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(inv.invoice_number LIKE ? OR p.name LIKE ? OR pv.variant_name LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as zero_tax_items FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id WHERE inv.status = 'completed' AND ii.gst_rate_percent_snapshot = 0",
    params: [],
    buildWarning: (row) => null
  })
};

export const businessPerformanceDataSource: DataSourceDefinition = {
  id: 'business_performance',
  name: 'Executive Business Performance',
  description: 'Master executive KPI overview (Revenue, COGS, Margins, Expenses, Operating Profit, Average Ticket) with trend and comparison support',
  dimensions: [
    { id: 'invoice_date', name: 'Date', type: 'date', dbColumn: 'DATE(inv.completed_at)' },
    { id: 'month_year', name: 'Month', type: 'string', dbColumn: "strftime('%Y-%m', inv.completed_at)" },
    { 
      id: 'day_of_week', 
      name: 'Day of Week', 
      type: 'string', 
      dbColumn: `CASE strftime('%w', inv.completed_at) 
        WHEN '0' THEN 'Sunday' 
        WHEN '1' THEN 'Monday' 
        WHEN '2' THEN 'Tuesday' 
        WHEN '3' THEN 'Wednesday' 
        WHEN '4' THEN 'Thursday' 
        WHEN '5' THEN 'Friday' 
        WHEN '6' THEN 'Saturday' 
      END` 
    },
    { id: 'hour_of_day', name: 'Hour', type: 'string', dbColumn: "strftime('%H:00', inv.completed_at)" },
    { id: 'category', name: 'Category', type: 'string', dbColumn: "COALESCE(p.category, 'Uncategorized')" },
  ],
  measures: [
    { id: 'gross_sales_paise', name: 'Gross Revenue (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_subtotal_paise' },
    { id: 'discounts_paise', name: 'Discounts (₹)', type: 'currency', aggregation: 'sum', dbExpression: '0' },
    { id: 'net_sales_paise', name: 'Net Sales (₹)', type: 'currency', aggregation: 'sum', dbExpression: 'ii.line_total_paise' },
    { 
      id: 'cogs_paise', 
      name: 'COGS (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: 'COALESCE(NULLIF(ii.real_cogs_paise, 0), NULLIF(ii.estimated_cogs_paise, 0), (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * (CASE WHEN p.unit_type = \'weight\' OR p.unit_type = \'live_dual\' THEN COALESCE(ii.quantity_grams, 0) / 1000.0 ELSE COALESCE(ii.quantity_units, 0) END)))' 
    },
    { 
      id: 'gross_profit_paise', 
      name: 'Gross Profit (₹)', 
      type: 'currency', 
      aggregation: 'sum', 
      dbExpression: '(ii.line_total_paise - COALESCE(NULLIF(ii.real_cogs_paise, 0), NULLIF(ii.estimated_cogs_paise, 0), (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * (CASE WHEN p.unit_type = \'weight\' OR p.unit_type = \'live_dual\' THEN COALESCE(ii.quantity_grams, 0) / 1000.0 ELSE COALESCE(ii.quantity_units, 0) END))))' 
    },
    { 
      id: 'gross_margin_percent', 
      name: 'Gross Margin %', 
      type: 'percent', 
      aggregation: 'avg', 
      dbExpression: 'ROUND(((ii.line_total_paise - COALESCE(NULLIF(ii.real_cogs_paise, 0), NULLIF(ii.estimated_cogs_paise, 0), (COALESCE(NULLIF(pv.weighted_average_cost, 0), NULLIF(pv.last_purchase_cost, 0), pv.cost_price_paise_per_unit, 0) * (CASE WHEN p.unit_type = \'weight\' OR p.unit_type = \'live_dual\' THEN COALESCE(ii.quantity_grams, 0) / 1000.0 ELSE COALESCE(ii.quantity_units, 0) END)))) * 100.0) / NULLIF(ii.line_total_paise, 0), 2)' 
    },
    { 
      id: 'total_weight_kg', 
      name: 'Weight Sold (kg)', 
      type: 'weight', 
      aggregation: 'sum', 
      dbExpression: 'ROUND(COALESCE(ii.quantity_grams, 0) / 1000.0, 3)' 
    },
    { 
      id: 'total_quantity', 
      name: 'Quantity Sold', 
      type: 'number', 
      aggregation: 'sum', 
      dbExpression: "CASE WHEN p.unit_type = 'weight' OR p.unit_type = 'live_dual' THEN ROUND(COALESCE(ii.quantity_grams, 0) / 1000.0, 3) ELSE COALESCE(ii.quantity_units, 0) END" 
    },
    { id: 'invoices_count', name: 'Orders Count', type: 'count', aggregation: 'count', dbExpression: 'inv.id' },
  ],
  getBaseQuery: (filters?: GlobalFilterState) => {
    let fromClause = `
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      JOIN product_variants pv ON ii.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
    `;

    const whereConditions: string[] = ["inv.status = 'completed'"];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push("DATE(inv.completed_at) >= ?");
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push("DATE(inv.completed_at) <= ?");
        params.push(filters.endDate);
      }
      if (filters.categoryId && filters.categoryId !== 'all') {
        whereConditions.push("p.category = ?");
        params.push(filters.categoryId);
      }
      if (filters.cashierId && filters.cashierId !== 'all') {
        whereConditions.push("inv.created_by = ?");
        params.push(filters.cashierId);
      }
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = `%${filters.searchTerm.trim()}%`;
        whereConditions.push("(p.name LIKE ? OR pv.variant_name LIKE ? OR inv.invoice_number LIKE ?)");
        params.push(term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as incomplete FROM invoices WHERE status = 'draft'",
    params: [],
    buildWarning: (row) => row?.incomplete > 0 ? `ℹ️ ${row.incomplete} draft invoices exist in the system.` : null
  })
};

// ============================================================================
// 26. DELIVERY OPERATIONS & PERFORMANCE DATA SOURCE
// ============================================================================
export const deliveryOperationsDataSource: DataSourceDefinition = {
  id: 'delivery_operations',
  name: 'Delivery Operations & Performance',
  description: 'Master delivery orders ledger with address, zone, driver, SLA timings, COD amounts, and performance metrics',

  dimensions: [
    { id: 'delivery_id', name: 'Delivery ID', type: 'number', dbColumn: 'd.id', filterable: true, sortable: true },
    { id: 'delivery_number', name: 'Delivery #', type: 'string', dbColumn: 'd.delivery_number', filterable: true, sortable: true, groupable: true },
    { id: 'requested_date', name: 'Date', type: 'date', dbColumn: 'd.requested_date', filterable: true, sortable: true, groupable: true },
    { id: 'time_slot', name: 'Time Slot', type: 'string', dbColumn: "COALESCE(d.time_slot_start || ' - ' || d.time_slot_end, 'Immediate')", filterable: true, sortable: true, groupable: true },
    { id: 'delivery_type', name: 'Delivery Type', type: 'string', dbColumn: 'd.delivery_type', filterable: true, sortable: true, groupable: true },
    { id: 'priority', name: 'Priority', type: 'string', dbColumn: 'd.priority', filterable: true, sortable: true, groupable: true },
    { id: 'status', name: 'Delivery Status', type: 'string', dbColumn: 'd.status', filterable: true, sortable: true, groupable: true },
    { id: 'customer_id', name: 'Customer ID', type: 'number', dbColumn: 'd.customer_id', filterable: true, sortable: true },
    { id: 'customer_name', name: 'Customer', type: 'string', dbColumn: 'c.name', filterable: true, sortable: true, groupable: true },
    { id: 'customer_phone', name: 'Phone', type: 'string', dbColumn: 'c.phone', filterable: true, sortable: true },
    { id: 'address_area', name: 'Area / Locality', type: 'string', dbColumn: "COALESCE(ca.area, 'Direct Pickup')", filterable: true, sortable: true, groupable: true },
    { id: 'zone_id', name: 'Zone ID', type: 'number', dbColumn: 'd.zone_id', filterable: true, sortable: true },
    { id: 'zone_name', name: 'Delivery Zone', type: 'string', dbColumn: "COALESCE(z.name, 'Default Zone')", filterable: true, sortable: true, groupable: true },
    { id: 'driver_id', name: 'Driver ID', type: 'number', dbColumn: 'd.driver_id', filterable: true, sortable: true },
    { id: 'driver_name', name: 'Driver', type: 'string', dbColumn: "COALESCE(drv.name, 'Unassigned')", filterable: true, sortable: true, groupable: true },
    { id: 'driver_phone', name: 'Driver Phone', type: 'string', dbColumn: "COALESCE(drv.phone, '')", filterable: true, sortable: true },
    { id: 'vehicle_number', name: 'Vehicle #', type: 'string', dbColumn: "COALESCE(drv.vehicle_number, '')", filterable: true, sortable: true },
    { id: 'invoice_id', name: 'Invoice ID', type: 'number', dbColumn: 'd.invoice_id', filterable: true, sortable: true },
    { id: 'invoice_number', name: 'Invoice #', type: 'string', dbColumn: 'inv.invoice_number', filterable: true, sortable: true, groupable: true },
    { id: 'payment_method', name: 'Payment Tender', type: 'string', dbColumn: 'd.payment_method', filterable: true, sortable: true, groupable: true },
    { id: 'payment_status', name: 'Payment Status', type: 'string', dbColumn: 'd.payment_status', filterable: true, sortable: true, groupable: true },
  ],

  measures: [
    { id: 'subtotal_paise', name: 'Order Subtotal', type: 'currency', dbExpression: 'd.subtotal_paise', aggregation: 'sum' },
    { id: 'delivery_charge_paise', name: 'Delivery Fee', type: 'currency', dbExpression: 'd.delivery_charge_paise', aggregation: 'sum' },
    { id: 'total_paise', name: 'Total Revenue', type: 'currency', dbExpression: 'd.total_paise', aggregation: 'sum' },
    { id: 'cod_expected_paise', name: 'COD Expected', type: 'currency', dbExpression: 'd.cod_expected_paise', aggregation: 'sum' },
    { id: 'cod_collected_paise', name: 'COD Collected', type: 'currency', dbExpression: 'd.cod_collected_paise', aggregation: 'sum' },
    { id: 'cod_variance_paise', name: 'COD Variance', type: 'currency', dbExpression: 'd.cod_variance_paise', aggregation: 'sum' },
    { id: 'estimated_minutes', name: 'Est. Duration (mins)', type: 'number', dbExpression: 'd.estimated_minutes', aggregation: 'avg' },
    { id: 'actual_prep_minutes', name: 'Actual Prep (mins)', type: 'number', dbExpression: 'd.actual_prep_minutes', aggregation: 'avg' },
    { id: 'actual_delivery_minutes', name: 'Actual Delivery (mins)', type: 'number', dbExpression: 'd.actual_delivery_minutes', aggregation: 'avg' },
    { id: 'driver_payout_paise', name: 'Driver Cost (Est.)', type: 'currency', dbExpression: '3500', aggregation: 'sum' },
    { id: 'contribution_margin_paise', name: 'Delivery Margin', type: 'currency', dbExpression: '(d.delivery_charge_paise - 3500)', aggregation: 'sum' },
    { id: 'deliveries_count', name: 'Deliveries', type: 'number', dbExpression: 'd.id', aggregation: 'count' },
  ],

  getBaseQuery: (filters) => {
    const fromClause = `
      FROM deliveries d
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN customer_addresses ca ON d.customer_address_id = ca.id
      LEFT JOIN delivery_zones z ON d.zone_id = z.id
      LEFT JOIN delivery_drivers drv ON d.driver_id = drv.id
      LEFT JOIN invoices inv ON d.invoice_id = inv.id
    `;

    const whereConditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters) {
      if (filters.startDate) {
        whereConditions.push('d.requested_date >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push('d.requested_date <= ?');
        params.push(filters.endDate);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        whereConditions.push('d.payment_method = ?');
        params.push(filters.paymentMethod);
      }
      if (filters.searchTerm) {
        whereConditions.push('(d.delivery_number LIKE ? OR c.name LIKE ? OR drv.name LIKE ? OR inv.invoice_number LIKE ?)');
        const term = `%${filters.searchTerm}%`;
        params.push(term, term, term, term);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    return { fromClause, whereClause, params };
  },

  getDataQualityWarnings: () => ({
    query: "SELECT COUNT(*) as unassigned FROM deliveries WHERE driver_id IS NULL AND status IN ('pending', 'ready_for_dispatch')",
    params: [],
    buildWarning: (row) => row?.unassigned > 0 ? `⚠️ ${row.unassigned} deliveries are ready/pending without an assigned driver.` : null
  })
};

// Catalog of all registered data sources
export const dataSourcesCatalog: Record<string, DataSourceDefinition> = {
  sales_transactions: salesTransactionsDataSource,
  sales_returns: salesReturnsDataSource,
  payment_records: paymentRecordsDataSource,
  upi_reconciliation: upiReconciliationDataSource,
  cogs_inventory: cogsInventoryDataSource,
  customer_sales_intelligence: customerSalesIntelligenceDataSource,
  ar_outstanding_invoices: arOutstandingInvoicesDataSource,
  ar_aging_summary: arAgingSummaryDataSource,
  customer_payment_behavior: customerPaymentBehaviorDataSource,
  customer_advances: customerAdvancesDataSource,
  stock_on_hand: stockOnHandDataSource,
  inventory_movement_ledger: inventoryMovementLedgerDataSource,
  meat_yield_processing: meatYieldProcessingDataSource,
  inventory_wastage_loss: inventoryWastageLossDataSource,
  dead_stock_analysis: deadStockAnalysisDataSource,
  purchase_transactions: purchaseTransactionsDataSource,
  supplier_procurement_summary: supplierProcurementSummaryDataSource,
  purchase_cost_variance: purchaseCostVarianceDataSource,
  expense_records: expenseRecordsDataSource,
  cash_box_shifts: cashBoxShiftsDataSource,
  employee_cashier_performance: employeeCashierPerformanceDataSource,
  void_cancelled_transactions: voidCancelledTransactionsDataSource,
  unified_audit_trail: unifiedAuditTrailDataSource,
  tax_gst_breakdown: taxGstBreakdownDataSource,
  business_performance: businessPerformanceDataSource,
  delivery_operations: deliveryOperationsDataSource,
};




