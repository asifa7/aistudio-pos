import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { StockStatus, StockTransaction, StockAdjustment, Supplier, Purchase } from '../types/inventory.types';

export function useStockStatus() {
  return useQuery<StockStatus[]>({
    queryKey: ['inventory', 'stock'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_STOCK);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 10000, // Poll stock levels every 10s
    staleTime: 10000,
  });
}

export function useLowStockAlerts() {
  return useQuery<StockStatus[]>({
    queryKey: ['inventory', 'low-stock'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_LOW_STOCK);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
    staleTime: 15000,
  });
}

export function useStockTransactions(limit = 100) {
  return useQuery<StockTransaction[]>({
    queryKey: ['inventory', 'transactions', limit],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_TXN_HISTORY, { limit });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useStockAdjustments(limit = 100) {
  return useQuery<StockAdjustment[]>({
    queryKey: ['inventory', 'adjustments', limit],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_ADJ_HISTORY, { limit });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_variant_id: number;
      adjustment_type: 'stock_in' | 'stock_out' | 'wastage' | 'damage';
      quantity_grams: number | null;
      quantity_units: number | null;
      reason: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.ADJUST_STOCK, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'low-stock'] });
    },
  });
}

export function useOversoldRecords() {
  return useQuery<any[]>({
    queryKey: ['inventory', 'oversold'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_OVERSOLD_RECORDS);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}


export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ['inventory', 'suppliers'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_SUPPLIERS);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    staleTime: 60000,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; contact?: string | null }) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CREATE_SUPPLIER, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
    },
  });
}

export function useRecordPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplier_id: number;
      product_variant_id: number;
      quantity_grams: number | null;
      quantity_units: number | null;
      cost_paise: number;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.RECORD_PURCHASE, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function usePurchases() {
  return useQuery<Purchase[]>({
    queryKey: ['inventory', 'purchases'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_PURCHASES);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useInventoryIndicators() {
  return useQuery<Record<number, { lastIn: { date: string; qty: string } | null, lastOut: { date: string; qty: string } | null }>>({
    queryKey: ['inventory', 'indicators'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_INDICATORS);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useLastPhysicalCount() {
  return useQuery<string | null>({
    queryKey: ['inventory', 'last-physical-count'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_LAST_PHYSICAL_COUNT);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useSidebarSummary() {
  return useQuery<any>({
    queryKey: ['inventory', 'sidebar-summary'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_SIDEBAR_SUMMARY);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 10000,
  });
}

export function useSubmitPhysicalCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (counts: Array<{ product_variant_id: number; counted_quantity: number }>) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.SUBMIT_PHYSICAL_COUNT, { counts });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
