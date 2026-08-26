// useCustomerLedger.ts
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { LedgerEntry, CustomerStatement, AgingReportRow } from '../types/customer.types';

async function invoke<T>(channel: string, args?: unknown): Promise<T> {
  const res = await window.api.invoke(channel, args);
  if (!res.success) throw res.error ?? new Error('IPC error');
  return res.data as T;
}

// ─── Ledger ───────────────────────────────────────────────────

export function useCustomerLedger(
  customerId: number | null,
  opts?: { startDate?: string; endDate?: string; limit?: number; offset?: number }
) {
  return useQuery<LedgerEntry[]>({
    queryKey: ['customer-ledger', customerId, opts],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_LEDGER, { customer_id: customerId, ...opts }),
    enabled: customerId !== null,
    staleTime: 10_000,
  });
}

export function useCustomerStatement(
  customerId: number | null,
  startDate: string,
  endDate: string
) {
  return useQuery<CustomerStatement>({
    queryKey: ['customer-statement', customerId, startDate, endDate],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_STATEMENT, { customer_id: customerId, startDate, endDate }),
    enabled: customerId !== null && !!startDate && !!endDate,
    staleTime: 10_000,
  });
}

// ─── A/R Reports ─────────────────────────────────────────────

export function useARReports() {
  return {
    useAgingReport: (asOfDate?: string) =>
      useQuery<AgingReportRow[]>({
        queryKey: ['ar-aging', asOfDate],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_AGING_REPORT, { asOfDate }),
        staleTime: 60_000,
      }),

    useOutstandingReport: (filters?: { category?: string; minOutstanding?: number }) =>
      useQuery({
        queryKey: ['ar-outstanding', filters],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_OUTSTANDING_REPORT, filters),
        staleTime: 30_000,
      }),

    useCollectionReport: (startDate: string, endDate: string) =>
      useQuery({
        queryKey: ['ar-collection', startDate, endDate],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_COLLECTION_REPORT, { startDate, endDate }),
        enabled: !!startDate && !!endDate,
        staleTime: 30_000,
      }),

    useAdvanceReport: () =>
      useQuery({
        queryKey: ['ar-advance'],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_ADVANCE_REPORT),
        staleTime: 30_000,
      }),

    useOverdueReport: (asOfDate?: string) =>
      useQuery({
        queryKey: ['ar-overdue', asOfDate],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_OVERDUE_REPORT, { asOfDate }),
        staleTime: 30_000,
      }),

    useTopDebtors: (limit = 10) =>
      useQuery({
        queryKey: ['ar-top-debtors', limit],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_TOP_DEBTORS, { limit }),
        staleTime: 30_000,
      }),

    useCreditUtilization: () =>
      useQuery({
        queryKey: ['ar-credit-util'],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_UTILIZATION),
        staleTime: 60_000,
      }),
  };
}
