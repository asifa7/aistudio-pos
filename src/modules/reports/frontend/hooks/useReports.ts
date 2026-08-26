import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface SalesSummary {
  totalInvoices: number;
  totalRevenuePaise: number;
  totalTaxPaise: number;
  subtotalPaise: number;
  gstRevenuePaise: number;
  nonGstRevenuePaise: number;
  totalDiscountPaise: number;
  paymentSplit?: {
    cashPaise?: number;
    upiPaise?: number;
    cardPaise?: number;
    creditPaise?: number;
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

export function useSalesSummary(startDate: string, endDate: string) {
  return useQuery<SalesSummary>({
    queryKey: ['reports', 'sales-summary', startDate, endDate],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_SALES_SUMMARY, { startDate, endDate });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useCategorySales(startDate: string, endDate: string) {
  return useQuery<CategorySales[]>({
    queryKey: ['reports', 'category-sales', startDate, endDate],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_CATEGORY_SALES, { startDate, endDate });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useProfitSummary(startDate: string, endDate: string) {
  return useQuery<ProfitSummary>({
    queryKey: ['reports', 'profit-summary', startDate, endDate],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_PROFIT_SUMMARY, { startDate, endDate });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}
