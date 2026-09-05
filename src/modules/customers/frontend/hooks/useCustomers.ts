// useCustomers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { 
  Customer, 
  CustomerGroup, 
  ActivityLog, 
  CustomerPurchaseInvoice, 
  CustomerOverviewSummary, 
  DuplicateCheckResult,
  CustomerIntelligence,
  TimelineEventItem,
  CrmAlertsSummary,
  AttentionCustomerItem,
  UpiMatchResult,
  CustomerUpiIdentity
} from '../types/customer.types';

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
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['customers'] }); 
    },
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
      qc.invalidateQueries({ queryKey: ['customer-overview', id] });
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

export function useCustomerPurchaseHistory(customerId: number | null, limit = 50, offset = 0) {
  return useQuery<{ invoices: CustomerPurchaseInvoice[]; total_count: number }>({
    queryKey: ['customer-purchase-history', customerId, limit, offset],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_PURCHASE_HISTORY, { customer_id: customerId, limit, offset }),
    enabled: customerId !== null,
    staleTime: 10_000,
  });
}

export function useCustomerOverviewSummary(customerId: number | null) {
  return useQuery<CustomerOverviewSummary>({
    queryKey: ['customer-overview', customerId],
    queryFn: () => invoke<CustomerOverviewSummary>(IPC_CHANNELS.CUSTOMERS.GET_OVERVIEW_SUMMARY, { customer_id: customerId }),
    enabled: customerId !== null,
    staleTime: 10_000,
  });
}

export function useCheckCustomerDuplicates() {
  return useMutation<DuplicateCheckResult, Error, { phone?: string | null; whatsapp?: string | null; name?: string | null; email?: string | null; excludeId?: number | null }>({
    mutationFn: (criteria) => invoke(IPC_CHANNELS.CUSTOMERS.CHECK_DUPLICATES, criteria),
  });
}

export function useCustomerIntelligence(customerId: number | null, forceRefresh = false) {
  return useQuery<CustomerIntelligence>({
    queryKey: ['customer-intelligence', customerId, forceRefresh],
    queryFn: () => invoke<CustomerIntelligence>(IPC_CHANNELS.CUSTOMERS.GET_INTELLIGENCE, { customer_id: customerId, force_refresh: forceRefresh }),
    enabled: customerId !== null,
    staleTime: 10_000,
  });
}

export function useMergeCustomers() {
  const qc = useQueryClient();
  return useMutation<any, Error, { source_customer_id: number; target_customer_id: number; reason?: string }>({
    mutationFn: (payload) => invoke(IPC_CHANNELS.CUSTOMERS.MERGE, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer'] });
      qc.invalidateQueries({ queryKey: ['customer-overview'] });
      qc.invalidateQueries({ queryKey: ['customer-purchase-history'] });
      qc.invalidateQueries({ queryKey: ['customer-intelligence'] });
      qc.invalidateQueries({ queryKey: ['customer-ledger'] });
      qc.invalidateQueries({ queryKey: ['customer-credit'] });
    },
  });
}

export function useCustomerTimeline(customerId: number | null, limit = 100) {
  return useQuery<TimelineEventItem[]>({
    queryKey: ['customer-timeline', customerId, limit],
    queryFn: () => invoke<TimelineEventItem[]>(IPC_CHANNELS.CUSTOMERS.GET_TIMELINE, { customer_id: customerId, limit }),
    enabled: customerId !== null,
    staleTime: 5_000,
  });
}

export function useCrmAlertsSummary() {
  return useQuery<CrmAlertsSummary>({
    queryKey: ['customer-crm-alerts-summary'],
    queryFn: () => invoke<CrmAlertsSummary>(IPC_CHANNELS.CUSTOMERS.GET_CRM_ALERTS),
    staleTime: 10_000,
  });
}

export function useCustomersNeedingAttention(sortBy: 'days_overdue' | 'lifetime_value' = 'days_overdue', limit = 50) {
  return useQuery<AttentionCustomerItem[]>({
    queryKey: ['customers-needing-attention', sortBy, limit],
    queryFn: () => invoke<AttentionCustomerItem[]>(IPC_CHANNELS.CUSTOMERS.GET_NEEDING_ATTENTION, { sortBy, limit }),
    staleTime: 10_000,
  });
}

export function useMatchUpiPayment() {
  return useMutation<UpiMatchResult, Error, { vpa?: string | null; payer_name?: string | null; amount_paise?: number; ref_number?: string | null }>({
    mutationFn: (payload) => invoke<UpiMatchResult>(IPC_CHANNELS.CUSTOMERS.MATCH_UPI, payload),
  });
}

export function useConfirmUpiIdentity() {
  const qc = useQueryClient();
  return useMutation<CustomerUpiIdentity, Error, { customer_id: number; vpa: string; payer_name?: string | null; auto_link?: boolean }>({
    mutationFn: (payload) => invoke<CustomerUpiIdentity>(IPC_CHANNELS.CUSTOMERS.CONFIRM_UPI, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['customer-upi-identities', vars.customer_id] });
    },
  });
}

export function useCustomerUpiIdentities(customerId: number | null) {
  return useQuery<CustomerUpiIdentity[]>({
    queryKey: ['customer-upi-identities', customerId],
    queryFn: () => invoke<CustomerUpiIdentity[]>(IPC_CHANNELS.CUSTOMERS.GET_UPI_IDENTITIES, { customer_id: customerId }),
    enabled: customerId !== null,
  });
}

