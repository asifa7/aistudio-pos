// useCustomers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { Customer, CustomerGroup, ActivityLog } from '../types/customer.types';

async function invoke<T>(channel: string, args?: unknown): Promise<T> {
  const res = await window.api.invoke(channel, args) as { success: boolean; data?: any; error?: any };
  if (!res.success) throw res.error ?? new Error('IPC error');
  return res.data as T;
}

// ─── Customers ──────────────────────────────────────────────

export function useCustomers(includeInactive = false) {
  return useQuery<Customer[]>({
    queryKey: ['customers', { includeInactive }],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_ALL, { includeInactive }),
    staleTime: 30_000,
  });
}

export function useCustomer(id: number | null) {
  return useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_BY_ID, { id }),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

export function useCustomerGroups() {
  return useQuery<CustomerGroup[]>({
    queryKey: ['customer-groups'],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_GROUPS),
    staleTime: 300_000,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Customer>) => invoke(IPC_CHANNELS.CUSTOMERS.CREATE, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Partial<Customer> }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.UPDATE, { id, fields }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', id] });
    },
  });
}

export function useDeactivateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoke(IPC_CHANNELS.CUSTOMERS.DEACTIVATE, { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });
}

export function useCustomerActivityLog(customerId: number | null, limit = 50) {
  return useQuery<ActivityLog[]>({
    queryKey: ['customer-activity', customerId],
    queryFn: () => invoke<ActivityLog[]>(IPC_CHANNELS.CUSTOMERS.GET_ACTIVITY_LOG, { customer_id: customerId, limit }),
    enabled: customerId !== null,
    staleTime: 15_000,
  });
}
