// useCustomerLedger.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type {
  LedgerEntry,
  CustomerStatement,
  AgingReportResult,
  CollectionReportResult,
} from '../types/customer.types';

async function invoke<T>(channel: string, args?: unknown): Promise<T> {
  const res = await window.api.invoke(channel, args);
  if (!res.success) throw res.error ?? new Error('IPC error');
  return res.data as T;
}

// ─── Ledger & Statement ────────────────────────────────────────

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
  const queryClient = useQueryClient();

  return {
    useAgingReport: (opts?: { asOfDate?: string; boundaries?: number[] } | string) => {
      const parsedArgs = typeof opts === 'string' ? { asOfDate: opts } : opts;
      return useQuery<AgingReportResult>({
        queryKey: ['ar-aging', parsedArgs],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_AGING_REPORT, parsedArgs),
        staleTime: 30_000,
      });
    },

    useAgingSettings: () =>
      useQuery<{ boundaries: number[]; defaultBoundaries: number[] }>({
        queryKey: ['ar-aging-settings'],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_AGING_SETTINGS),
        staleTime: 60_000,
      }),

    useUpdateAgingSettings: () =>
      useMutation({
        mutationFn: (boundaries: number[]) =>
          invoke<{ success: boolean; boundaries: number[] }>(IPC_CHANNELS.CUSTOMERS.UPDATE_AGING_SETTINGS, { boundaries }),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['ar-aging-settings'] });
          queryClient.invalidateQueries({ queryKey: ['ar-aging'] });
        },
      }),

    useCustomerOverdueInvoices: (customerId: number | null, asOfDate?: string) =>
      useQuery<{
        customer: any;
        asOfDate: string;
        invoices: {
          id: number;
          invoice_number: string;
          completed_at: string;
          total_paise: number;
          paid_paise: number;
          remaining_paise: number;
          days_overdue: number;
          payment_status: string;
        }[];
      }>({
        queryKey: ['customer-overdue-invoices', customerId, asOfDate],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_OVERDUE_INVOICES, { customer_id: customerId, asOfDate }),
        enabled: customerId !== null,
        staleTime: 20_000,
      }),

    useOutstandingReport: (filters?: { category?: string; minOutstanding?: number }) =>
      useQuery({
        queryKey: ['ar-outstanding', filters],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_OUTSTANDING_REPORT, filters),
        staleTime: 30_000,
      }),

    useCollectionReport: (filters: { startDate: string; endDate: string; customerId?: number; method?: string; receivedBy?: number } | string, endDateParam?: string) => {
      const parsedArgs = typeof filters === 'string' ? { startDate: filters, endDate: endDateParam || filters } : filters;
      return useQuery<CollectionReportResult>({
        queryKey: ['ar-collection', parsedArgs],
        queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_COLLECTION_REPORT, parsedArgs),
        enabled: !!parsedArgs.startDate && !!parsedArgs.endDate,
        staleTime: 30_000,
      });
    },

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
