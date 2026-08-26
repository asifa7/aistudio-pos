import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface Branch {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: number;
  is_default: number;
  created_at: string;
  updated_at: string;
  has_history?: boolean;
  transfer_count?: number;
}

export interface CreateBranchInput {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  is_default?: boolean;
}

export interface UpdateBranchInput {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  is_default?: boolean;
}

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.LIST);
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
  });
}

export function useActiveBranches() {
  return useQuery<Branch[]>({
    queryKey: ['branches', 'active'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.GET_ACTIVE);
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
    staleTime: 30000,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBranchInput) => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.CREATE, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateBranchInput }) => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.UPDATE, { id, input });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
    },
  });
}

export function useToggleBranchActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.TOGGLE_ACTIVE, { id, isActive });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await window.api.invoke(IPC_CHANNELS.BRANCHES.DELETE, { id });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
    },
  });
}
