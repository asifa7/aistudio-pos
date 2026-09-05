import {
  IInvoiceRepository,
  IPurchaseRepository,
} from '../../../../core/database/repositories/repository_interfaces';
import {
  ReportQueryOptions,
  ReportQueryResult,
  ReportDefinition,
  ReportFilterOptions,
  ReportExportRequest
} from '../../types/reports.types';
import { reportEngine } from '../engine/report_engine';
import { getAllReportDefinitions, getReportDefinition } from '../engine/report_definitions';
import { savedReportsService } from './saved_reports_service';
import { reportAlertsService } from './report_alerts_service';
import { assertValidDateRange } from '../../../../core/utils/date_validation';

export interface SalesSummary {
  totalInvoices: number;
  totalRevenuePaise: number;
  totalTaxPaise: number;
  subtotalPaise: number;
  gstRevenuePaise: number;
  nonGstRevenuePaise: number;
  totalDiscountPaise: number;
  paymentSplit?: {
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    creditPaise: number;
  };
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

  // 1. Core Report Engine Methods
  public runReport(options: ReportQueryOptions): ReportQueryResult {
    return reportEngine.runReport(options);
  }

  public runCustomReport(config: any, userContext?: any): ReportQueryResult {
    return reportEngine.runCustomReport(config, userContext);
  }

  public buildPivot(options: ReportQueryOptions, pivotConfig: any, userContext?: any): any {
    return reportEngine.buildPivot(options, pivotConfig, userContext);
  }

  public saveReport(input: any) {
    return savedReportsService.saveReport(input);
  }

  public getSavedReports(userId?: number) {
    return savedReportsService.getSavedReports(userId);
  }

  public toggleFavorite(userId: number, reportId: string) {
    return savedReportsService.toggleFavorite(userId, reportId);
  }

  public getFavoriteReportIds(userId: number) {
    return savedReportsService.getFavoriteReportIds(userId);
  }

  public recordRecentReport(input: any) {
    return savedReportsService.recordRecentReport(input);
  }

  public getRecentReports(userId: number, limit?: number) {
    return savedReportsService.getRecentReports(userId, limit);
  }

  public getReportAlerts() {
    return reportAlertsService.generateReportAlerts();
  }

  public getReportDefinitions(): ReportDefinition[] {
    return getAllReportDefinitions();
  }

  public getReportDefinitionById(id: string): ReportDefinition | undefined {
    return getReportDefinition(id);
  }

  public getFilterOptions(): ReportFilterOptions {
    return reportEngine.getFilterOptions();
  }

  public exportReport(req: ReportExportRequest): {
    filename: string;
    mimeType: string;
    content: string;
  } {
    // Run report with unpaginated query for all_data or specific page
    const page = req.scope === 'current_page' ? 1 : 1;
    const pageSize = req.scope === 'all_data' ? -1 : 50;

    const result = reportEngine.runReport({
      reportId: req.reportId,
      filters: req.filters,
      selectedDimensions: req.selectedDimensions,
      selectedMeasures: req.selectedMeasures,
      groupBy: req.groupBy,
      sortBy: req.sortBy,
      page,
      pageSize,
    });

    let rowsToExport = result.rows;
    if (req.scope === 'selected_rows' && req.selectedRowIds && req.selectedRowIds.length > 0) {
      const idSet = new Set(req.selectedRowIds.map(String));
      rowsToExport = result.rows.filter(r => idSet.has(String(r._row_id || r.invoice_id)));
    }

    const headers = result.columns.map(c => `"${String(c.name || (c as any).label || c.id).replace(/"/g, '""')}"`);
    const csvRows = rowsToExport.map(row => {
      return result.columns.map(c => {
        let val = row[c.id];
        if (val === undefined || val === null) return '""';
        if (c.type === 'currency') {
          return (Number(val) / 100).toFixed(2);
        }
        if (c.type === 'weight') {
          return typeof val === 'number' ? val.toFixed(3) : val;
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    // Add Grand Total row to CSV
    const totalRow = result.columns.map((c, idx) => {
      if (idx === 0) return '"GRAND TOTAL"';
      if (c.isMeasure && result.grandTotals[c.id] !== undefined) {
        const val = result.grandTotals[c.id];
        if (c.type === 'currency') return (Number(val) / 100).toFixed(2);
        if (c.type === 'percent') return `${val}%`;
        return String(val);
      }
      return '""';
    }).join(',');

    const fileHeader = [
      `"${result.shopInfo.name}"`,
      `"Report: ${result.reportName}"`,
      `"Generated: ${result.generatedAt}"`,
      `"Filters: ${result.filterSummary.activeFilterChips.map(f => `${f.label}=${f.value}`).join(' | ') || 'None'}"`,
      '',
    ].join('\n');

    const csvContent = `${fileHeader}\n${headers.join(',')}\n${csvRows.join('\n')}\n${totalRow}`;
    const filename = `${result.reportId}_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      filename,
      mimeType: 'text/csv',
      content: csvContent,
    };
  }

  // 2. Legacy / Quick Analytics Summary Helpers
  public getSalesSummary(startDate: string, endDate: string): SalesSummary {
    assertValidDateRange(startDate, endDate);
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
    assertValidDateRange(startDate, endDate);
    const items = this.invoiceRepo.getInvoiceItemsByDate(startDate, endDate);
    const categoryMap = new Map<string, { revenue: number; grams: number; units: number }>();

    for (const item of items) {
      const category = (item as any).category || 'Uncategorized';
      const unitType = (item as any).unit_type || item.unit_type;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { revenue: 0, grams: 0, units: 0 });
      }

      const catObj = categoryMap.get(category)!;
      catObj.revenue += (item as any).line_total_paise || (item.line_subtotal_paise + Math.round(item.line_subtotal_paise * 0.05));
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
    assertValidDateRange(startDate, endDate);
    const items = this.invoiceRepo.getInvoiceItemsByDate(startDate, endDate);
    if (items.length === 0) {
      return {
        totalSalesRevenuePaise: 0,
        totalCostPaise: 0,
        grossProfitPaise: 0,
        profitMarginPercent: 0,
      };
    }

    const uniqueVariantIds = Array.from(new Set(items.map(item => item.product_variant_id)));
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
