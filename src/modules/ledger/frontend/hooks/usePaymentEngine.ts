import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface LiquidBalances {
  cashInHandPaise: number;
  bankBalancePaise: number;
  totalLiquidFundsPaise: number;
  posCashSalesPaise: number;
  posBankSalesPaise: number;
}

export interface OpenBill {
  id: number;
  bill_type: 'purchase_invoice' | 'sale_invoice';
  bill_number: string;
  invoice_number: string;
  supplier_invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  total_amount_paise: number;
  paid_amount_paise: number;
  outstanding_balance_paise: number;
  days_overdue?: number;
}

export interface PaymentReceiptVoucher {
  id: number;
  voucher_number: string;
  direction: 'payment' | 'receipt';
  payment_method: 'cash' | 'bank' | 'upi' | 'card';
  party_type: 'supplier' | 'customer' | 'other';
  party_id: number | null;
  party_name: string | null;
  category: string | null;
  amount_paise: number;
  allocated_amount_paise: number;
  unallocated_amount_paise: number;
  payment_date: string;
  narration: string | null;
  is_reversed?: number;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  reversed_payment_id?: number | null;
  idempotency_key?: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string;
  allocation_count?: number;
  allocations?: Array<{
    id: number;
    bill_type: string;
    bill_id: number;
    bill_number: string;
    allocated_amount_paise: number;
  }>;
}

export interface OutstandingPurchaseBill {
  id: number;
  invoice_number: string;
  supplier_invoice_number: string | null;
  purchase_ref_number: string | null;
  supplier_id: number;
  supplier_name: string;
  supplier_company: string;
  invoice_date: string;
  due_date: string | null;
  total_amount_paise: number;
  paid_amount_paise: number;
  outstanding_balance_paise: number;
  days_overdue: number;
  invoice_status: string;
  computed_payment_status: 'unpaid' | 'partial' | 'paid';
  payment_status?: 'unpaid' | 'partial' | 'paid';
}

export interface BillPaymentHistoryItem {
  allocation_id: number;
  allocated_amount_paise: number;
  allocated_at: string;
  voucher_id: number;
  voucher_number: string;
  payment_method: 'cash' | 'bank' | 'upi' | 'card';
  payment_date: string;
  direction: 'payment' | 'receipt';
  narration: string | null;
  is_reversed: number;
  reversed_at: string | null;
  reversal_reason: string | null;
  reversed_payment_id: number | null;
  created_by_name?: string;
}

export function useLiquidBalances() {
  return useQuery<LiquidBalances>({
    queryKey: ['payments-receipts', 'balances'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_BALANCES);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 10000,
  });
}

export function useOpenBills(partyType?: 'supplier' | 'customer', partyId?: number | null) {
  return useQuery<OpenBill[]>({
    queryKey: ['payments-receipts', 'open-bills', partyType, partyId],
    queryFn: async () => {
      if (!partyType || !partyId) return [];
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_OPEN_BILLS, { partyType, partyId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!partyType && !!partyId,
  });
}

export function useOutstandingPurchaseBills(filters?: {
  status?: 'outstanding' | 'paid' | 'unpaid' | 'partial' | 'all';
  supplierId?: number;
  search?: string;
  sortBy?: 'due_date' | 'total_amount' | 'outstanding' | 'supplier';
  sortOrder?: 'asc' | 'desc';
}) {
  return useQuery<OutstandingPurchaseBill[]>({
    queryKey: ['payments-receipts', 'outstanding-bills', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_OUTSTANDING_BILLS, filters || {});
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
    refetchInterval: 10000,
  });
}

export function useBillPaymentHistory(billType: 'purchase_invoice' | 'sale_invoice', billId?: number | null) {
  return useQuery<{ allocations: BillPaymentHistoryItem[]; totalPaidPaise: number }>({
    queryKey: ['payments-receipts', 'bill-history', billType, billId],
    queryFn: async () => {
      if (!billId) return { allocations: [], totalPaidPaise: 0 };
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_BILL_PAYMENT_HISTORY, { billType, billId });
      if (!res.success) throw new Error(res.error.message);
      return res.data || { allocations: [], totalPaidPaise: 0 };
    },
    enabled: !!billId,
  });
}

export function usePaymentRegister(filters: {
  startDate?: string;
  endDate?: string;
  direction?: string;
  paymentMethod?: string;
  partyType?: string;
  partyId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<{
    vouchers: PaymentReceiptVoucher[];
    summary: {
      totalPaymentsPaise: number;
      totalReceiptsPaise: number;
      netCashFlowPaise: number;
      count: number;
    };
  }>({
    queryKey: ['payments-receipts', 'register', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_REGISTER, filters);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function useDuePurchasesList(filters?: { supplierId?: number; startDate?: string; endDate?: string }) {
  return useQuery<OutstandingPurchaseBill[]>({
    queryKey: ['payments-receipts', 'due-purchases', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.GET_DUE_PURCHASES, filters || {});
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function useRecordPaymentReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      direction: 'payment' | 'receipt';
      payment_method: 'cash' | 'bank' | 'upi' | 'card';
      party_type?: 'supplier' | 'customer' | 'other';
      party_id?: number | null;
      party_name?: string | null;
      category?: string | null;
      amount_paise: number;
      payment_date: string;
      narration?: string | null;
      idempotency_key?: string | null;
      allocations?: Array<{
        bill_type: 'purchase_invoice' | 'sale_invoice';
        bill_id: number;
        bill_number: string;
        allocated_amount_paise: number;
      }>;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.RECORD, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['procurement'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { payment_receipt_id: number; reason: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.REVERSE, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['procurement'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRecordContraEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from_account: 'cash' | 'bank';
      to_account: 'cash' | 'bank';
      amount_paise: number;
      entry_date: string;
      narration?: string | null;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.PAYMENTS_RECEIPTS.RECORD_CONTRA, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-receipts'] });
    },
  });
}
