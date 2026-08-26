import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface AssetReplacement {
  id: number;
  asset_id: number;
  replacement_date: string;
  reason: string;
  replacement_cost_paise: number;
  notes: string | null;
  logged_by: number;
  created_at: string;
  logged_by_name?: string;
}

export interface AssetItem {
  id: number;
  name: string;
  category: string;
  purchase_cost_paise: number;
  purchase_date: string;
  status: 'active' | 'damaged' | 'replaced' | 'disposed';
  branch_id: number;
  times_replaced: number;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  branch_name?: string;
  created_by_name?: string;
  replacements?: AssetReplacement[];
}

export interface AssetSummary {
  totalActiveCostPaise: number;
  activeCount: number;
  totalCount: number;
  replacedCount: number;
  damagedCount: number;
  disposedCount: number;
  categoryBreakdown: Array<{
    category: string;
    total_items: number;
    active_cost_paise: number;
  }>;
}

export function useAssets(filters?: { category?: string; status?: string; branchId?: number }) {
  return useQuery<AssetItem[]>({
    queryKey: ['assets', 'list', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.LIST, filters);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useAssetSummary(branchId?: number) {
  return useQuery<AssetSummary>({
    queryKey: ['assets', 'summary', branchId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.GET_SUMMARY, { branchId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      category: string;
      purchase_cost_paise: number;
      purchase_date: string;
      status?: string;
      branch_id?: number;
      notes?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.CREATE, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: any }) => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.UPDATE, { id, input });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useRecordAssetReplacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      asset_id: number;
      replacement_date: string;
      reason: string;
      replacement_cost_paise?: number;
      notes?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.RECORD_REPLACEMENT, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await window.api.invoke(IPC_CHANNELS.ASSETS.DELETE, { id });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}
