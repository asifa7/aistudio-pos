// useCustomerCredit.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type {
  CreditAccount,
  CreditValidationResult,
  CreditNote,
  CreditTransaction,
  UnpaidInvoice,
  CustomerReminder,
} from '../types/customer.types';

async function invoke<T>(channel: string, args?: unknown): Promise<T> {
  const res = await window.api.invoke(channel, args);
  if (!res.success) throw res.error ?? new Error('IPC error');
  return res.data as T;
}

// ─── Credit Account ──────────────────────────────────────────

export function useCustomerCreditAccount(customerId: number | null) {
  return useQuery<CreditAccount>({
    queryKey: ['customer-credit-account', customerId],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_ACCOUNT, { customer_id: customerId }),
    enabled: customerId !== null,
    staleTime: 15_000,
  });
}

export function useValidateCreditSale(customerId: number | null, amountPaise: number) {
  return useQuery<CreditValidationResult>({
    queryKey: ['validate-credit-sale', customerId, amountPaise],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.VALIDATE_CREDIT_SALE, { customer_id: customerId, amount_paise: amountPaise }),
    enabled: customerId !== null && amountPaise > 0,
    staleTime: 5_000,
  });
}

export function useUpdateCreditLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; credit_limit_paise: number; soft_limit_paise?: number; hard_limit_paise?: number; grace_days?: number; max_overdue_days?: number; interest_rate_percent?: number }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.UPDATE_CREDIT_LIMIT, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer-credit-account', customer_id] });
      qc.invalidateQueries({ queryKey: ['customer', customer_id] });
    },
  });
}

export function useFreezeCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; reason: string }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.FREEZE_CREDIT, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer-credit-account', customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUnfreezeCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customer_id: number) =>
      invoke(IPC_CHANNELS.CUSTOMERS.UNFREEZE_CREDIT, { customer_id }),
    onSuccess: (_, customer_id) => {
      qc.invalidateQueries({ queryKey: ['customer-credit-account', customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useBlacklistCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; reason: string }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.BLACKLIST, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); },
  });
}

// ─── Payments ─────────────────────────────────────────────────

export function useRecordCustomerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customer_id: number;
      amount_paise: number;
      method: string;
      reference_number?: string | null;
      cheque_number?: string | null;
      cheque_date?: string | null;
      bank_name?: string | null;
      payment_date?: string;
      notes?: string | null;
    }) => invoke(IPC_CHANNELS.CUSTOMERS.RECORD_PAYMENT, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer', customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-ledger', customer_id] });
    },
  });
}

export function useDepositAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; amount_paise: number; method: string; reference_number?: string | null; notes?: string | null }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.DEPOSIT_ADVANCE, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer', customer_id] });
      qc.invalidateQueries({ queryKey: ['customer-ledger', customer_id] });
    },
  });
}

export function useWriteOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; amount_paise: number; reason: string }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.WRITE_OFF, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer', customer_id] });
      qc.invalidateQueries({ queryKey: ['customer-ledger', customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// ─── Credit Notes ─────────────────────────────────────────────

export function useCreditNotes(customerId: number | null) {
  return useQuery<CreditNote[]>({
    queryKey: ['credit-notes', customerId],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_NOTES, { customer_id: customerId }),
    enabled: customerId !== null,
    staleTime: 15_000,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; original_invoice_id?: number | null; amount_paise: number; reason: string }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.CREATE_CREDIT_NOTE, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['credit-notes', customer_id] });
      qc.invalidateQueries({ queryKey: ['customer', customer_id] });
      qc.invalidateQueries({ queryKey: ['customer-ledger', customer_id] });
    },
  });
}

// ─── Transactions ─────────────────────────────────────────────

export function useCreditTransactions(customerId: number | null, limit = 50) {
  return useQuery<CreditTransaction[]>({
    queryKey: ['credit-transactions', customerId, limit],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_CREDIT_TRANSACTIONS, { customer_id: customerId, limit }),
    enabled: customerId !== null,
    staleTime: 15_000,
  });
}

export function useUnpaidInvoices(customerId: number | null) {
  return useQuery<UnpaidInvoice[]>({
    queryKey: ['unpaid-invoices', customerId],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_UNPAID_INVOICES, { customer_id: customerId }),
    enabled: customerId !== null,
    staleTime: 10_000,
  });
}

// ─── Reminders ────────────────────────────────────────────────

export function useCustomerReminders(customerId: number | null) {
  return useQuery<CustomerReminder[]>({
    queryKey: ['customer-reminders', customerId],
    queryFn: () => invoke(IPC_CHANNELS.CUSTOMERS.GET_REMINDERS, { customer_id: customerId }),
    enabled: customerId !== null,
    staleTime: 30_000,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customer_id: number; channel: string; template_type: string; message: string; scheduled_for?: string | null }) =>
      invoke(IPC_CHANNELS.CUSTOMERS.CREATE_REMINDER, input),
    onSuccess: (_, { customer_id }) => {
      qc.invalidateQueries({ queryKey: ['customer-reminders', customer_id] });
    },
  });
}
