import {
  IInvoiceRepository,
  IPurchaseRepository,
  SalesSummaryRow,
  InvoiceItemReportRow
} from '../../../../core/database/repositories/repository_interfaces';

export interface SalesSummary {
  totalInvoices: number;
  totalRevenuePaise: number;
  totalTaxPaise: number;
  subtotalPaise: number;
  gstRevenuePaise: number;
  nonGstRevenuePaise: number;
  totalDiscountPaise: number;
}

export interface ProfitSummary {
  totalSalesRevenuePaise: number;
  totalCostPaise: number;
  grossProfitPaise: number;
  profitMarginPercent: number;
}

export interface CategorySales {
  category: string;
  revenuePaise: number;
  grams: number;
  units: number;
}

export class ReportsService {
  constructor(
    private invoiceRepo: IInvoiceRepository,
    private purchaseRepo: IPurchaseRepository
  ) {}

  public getSalesSummary(startDate: string, endDate: string): SalesSummary {
    const row = this.invoiceRepo.getSalesSummaryByDate(startDate, endDate);
    return {
      totalInvoices: row.total_invoices,
      totalRevenuePaise: row.total_revenue,
      totalTaxPaise: row.total_tax,
      subtotalPaise: row.subtotal,
      gstRevenuePaise: row.gst_revenue,
      nonGstRevenuePaise: row.non_gst_revenue,
      totalDiscountPaise: row.total_discount,
    };
  }

  public getCategorySales(startDate: string, endDate: string): CategorySales[] {
    const items = this.invoiceRepo.getInvoiceItemsByDate(startDate, endDate);
    const categoryMap = new Map<string, { revenue: number; grams: number; units: number }>();

    for (const item of items) {
      // Find category snapshot from variant
      const category = (item as any).category || 'Uncategorized';
      const unitType = (item as any).unit_type || item.unit_type;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { revenue: 0, grams: 0, units: 0 });
      }

      const catObj = categoryMap.get(category)!;
      catObj.revenue += (item as any).line_total_paise || (item.line_subtotal_paise + Math.round(item.line_subtotal_paise * 0.05)); // Fallback total
      if (unitType === 'weight' && item.quantity_grams !== null) {
        catObj.grams += item.quantity_grams;
      } else if (unitType === 'piece' && item.quantity_units !== null) {
        catObj.units += item.quantity_units;
      }
    }

    const result: CategorySales[] = [];
    categoryMap.forEach((val, category) => {
      result.push({
        category,
        revenuePaise: val.revenue,
        grams: val.grams,
        units: val.units,
      });
    });

    return result.sort((a, b) => b.revenuePaise - a.revenuePaise);
  }

  public getProfitSummary(startDate: string, endDate: string): ProfitSummary {
    // 1. Fetch completed invoice items inside date range
    const items = this.invoiceRepo.getInvoiceItemsByDate(startDate, endDate);
    if (items.length === 0) {
      return {
        totalSalesRevenuePaise: 0,
        totalCostPaise: 0,
        grossProfitPaise: 0,
        profitMarginPercent: 0,
      };
    }

    // 2. Identify unique variant IDs that had sales (bound the search domain)
    const uniqueVariantIds = Array.from(new Set(items.map(item => item.product_variant_id)));

    // 3. Fetch averages cost restricted ONLY to variants that had sales
    const purchaseRecords = this.purchaseRepo.getAverageCostForVariants(uniqueVariantIds);
    const avgCostMap = new Map<number, { costPerGram: number; costPerUnit: number }>();
    purchaseRecords.forEach(p => {
      const costPerGram = p.total_grams ? p.total_cost / p.total_grams : 0;
      const costPerUnit = p.total_units ? p.total_cost / p.total_units : 0;
      avgCostMap.set(p.product_variant_id, { costPerGram, costPerUnit });
    });

    let totalSalesRevenuePaise = 0;
    let totalCostPaise = 0;

    items.forEach(item => {
      totalSalesRevenuePaise += item.line_subtotal_paise;
      
      const avgCost = avgCostMap.get(item.product_variant_id);
      if (avgCost) {
        if (item.unit_type === 'weight' && item.quantity_grams !== null) {
          totalCostPaise += Math.round(item.quantity_grams * avgCost.costPerGram);
        } else if (item.unit_type === 'piece' && item.quantity_units !== null) {
          totalCostPaise += Math.round(item.quantity_units * avgCost.costPerUnit);
        }
      } else {
        // Fallback: assume COGS is 65% of selling price if no purchases are logged
        totalCostPaise += Math.round(item.line_subtotal_paise * 0.65);
      }
    });

    const grossProfitPaise = totalSalesRevenuePaise - totalCostPaise;
    const profitMarginPercent = totalSalesRevenuePaise > 0 
      ? Math.round((grossProfitPaise / totalSalesRevenuePaise) * 10000) / 100
      : 0;

    return {
      totalSalesRevenuePaise,
      totalCostPaise,
      grossProfitPaise,
      profitMarginPercent,
    };
  }
}

import { container } from '../../../../core/di/container';
export const reportsService = container.reportsService;
export default reportsService;
