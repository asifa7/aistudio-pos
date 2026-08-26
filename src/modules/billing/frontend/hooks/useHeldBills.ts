import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { Invoice } from '../types/billing.types';

export function useHeldBills() {
  return useQuery<Invoice[]>({
    queryKey: ['billing', 'held'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.BILLING.LIST_HELD);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 5000,
  });
}
