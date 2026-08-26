import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface InventoryLedgerActivity {
  id: number;
  product_variant_id: number;
  branch_id: number;
  action_type: 'purchase' | 'sale' | 'return' | 'transfer_out' | 'transfer_in' | 'yield_in' | 'yield_out' | 'audit_adjustment' | 'wastage';
  quantity_grams: number | null;
  quantity_units: number | null;
  running_balance_grams: number | null;
  running_balance_units: number | null;
  unit_cost_paise: number;
  reference_type: string | null;
  reference_id: number | null;
  reference_number: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  variant_name: string;
  product_name: string;
  unit_type: string;
  branch_name: string | null;
  branch_code: string | null;
  created_by_name: string | null;
  is_weight: boolean;
  quantity_display: number | null;
  running_balance_display: number;
  unit_label: string;
}

export interface InventoryValuationItem {
  variant_id: number;
  product_id: number;
  product_name: string;
  variant_name: string;
  product_code: string;
  category: string;
  unit_type: string;
  stock_classification: 'live_yield' | 'refrigerator_direct';
  is_weight: boolean;
  quantity: number;
  unit_label: string;
  buying_cost_paise: number;
  selling_price_paise: number;
  total_buying_paise: number;
  total_selling_paise: number;
  potential_profit_paise: number;
}

export interface InventoryValuationReport {
  items: InventoryValuationItem[];
  summary: {
    itemCount: number;
    totalBuyingValuePaise: number;
    totalPotentialSellingValuePaise: number;
    potentialProfitPaise: number;
    profitMarginPercent: number;
  };
}

export function useInventoryActivityLog(filters: {
  startDate?: string;
  endDate?: string;
  productVariantIds?: number[];
  actionTypes?: string[];
  branchId?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery<InventoryLedgerActivity[]>({
    queryKey: ['inventory-ledger', 'activity-log', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY_LEDGER.GET_ACTIVITY_LOG, filters);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function useInventoryValuationReport(filters: {
  startDate?: string;
  endDate?: string;
  productVariantIds?: number[];
  branchId?: number;
}) {
  return useQuery<InventoryValuationReport>({
    queryKey: ['inventory-ledger', 'valuation-report', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY_LEDGER.GET_VALUATION_REPORT, filters);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
  });
}
