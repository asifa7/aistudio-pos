import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface RefrigeratorStockItem {
  product_variant_id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  variant_name: string;
  category: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  quantity: number;
  safety_threshold?: number;
  unit_cost_paise: number;
  stored_at: string;
  days_in_fridge: number;
  oldest_batch_id?: number | null;
  oldest_batch_number?: string | null;
  batch_count?: number;
  batch_id?: number | null;
  batch_number?: string;
}

export function useRefrigeratorStock(branchId: number = 1) {
  return useQuery<RefrigeratorStockItem[]>({
    queryKey: ['inventory', 'refrigerator-stock', branchId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_REFRIGERATOR_STOCK, { branchId });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load refrigerator stock');
      }
      return res.data || [];
    },
    refetchInterval: 30000,
  });
}

export interface FridgeRemovalPayload {
  batch_id?: number;
  product_variant_id: number;
  quantity: number;
  unit_type: string;
  reason?: string;
  branch_id?: number;
}

export function useRecordFridgeRemoval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FridgeRemovalPayload) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.RECORD_FRIDGE_REMOVAL, payload);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to remove stock from refrigerator');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fridge-activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export interface FridgeAdditionPayload {
  product_variant_id: number;
  quantity: number;
  unit_type: string;
  entry_date?: string;
  cost_price_paise_per_unit?: number;
  batch_number?: string;
  notes?: string;
  branch_id?: number;
}

export function useRecordFridgeAddition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FridgeAdditionPayload) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.RECORD_FRIDGE_ADDITION, payload);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to add stock to refrigerator');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fridge-activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export interface FridgeActivityItem {
  id: number;
  created_at: string;
  action_type: string;
  quantity_grams: number | null;
  quantity_units: number | null;
  notes: string | null;
  reference_type: string | null;
  product_name: string;
  variant_name: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  user_name: string | null;
}

export function useFridgeActivityLog(branchId: number = 1, limit: number = 50) {
  return useQuery<FridgeActivityItem[]>({
    queryKey: ['fridge-activity-log', branchId, limit],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_FRIDGE_ACTIVITY_LOG, { branchId, limit });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load refrigerator activity log');
      }
      return res.data || [];
    },
    refetchInterval: 15000,
  });
}
