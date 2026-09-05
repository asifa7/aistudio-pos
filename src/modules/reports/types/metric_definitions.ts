import { MetricDefinition } from './reports.types';

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  gross_profit: {
    id: 'gross_profit',
    name: 'Gross Profit',
    formula: 'Net Sales − Cost of Goods Sold (COGS)',
    description: 'The real earnings retained after accounting for meat batch procurement & processing costs.',
    reconciliationTip: 'Reconciles with COGS & Inventory Valuation report.'
  },
  gross_margin: {
    id: 'gross_margin',
    name: 'Gross Margin %',
    formula: '(Gross Profit ÷ Net Sales) × 100',
    description: 'Percentage of revenue retained as gross profit on meat items.',
    reconciliationTip: 'Targets typically range from 18% to 35% for retail meat cuts.'
  },
  avg_ticket: {
    id: 'avg_ticket',
    name: 'Average Ticket / Basket',
    formula: 'Total Net Sales ÷ Total Invoices Count',
    description: 'Average invoice spend per customer checkout visit.',
  },
  actual_yield_percent: {
    id: 'actual_yield_percent',
    name: 'Actual Meat Yield %',
    formula: '(Saleable Meat Weight ÷ Total Carcass Input Weight) × 100',
    description: 'Percentage of raw livestock/carcass converted into sellable prime cuts vs bone/fat waste.',
    reconciliationTip: 'Reconciles with Yield Processing runs.'
  },
  cash_variance: {
    id: 'cash_variance',
    name: 'Shift Cash Variance',
    formula: 'Physical Cash Counted − Expected System Cash',
    description: 'Till discrepancy between physical drawer count and expected net cash balance.',
    reconciliationTip: 'Reconciles against shift closing ledger snapshots.'
  },
  customer_frequency: {
    id: 'customer_frequency',
    name: 'Customer Visit Frequency',
    formula: 'Total Completed Orders ÷ Lifetime Customer Active Days',
    description: 'How frequently a customer returns to shop (Daily, Weekly, Bi-weekly, Monthly).',
  },
};
