import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { AdminProduct, AdminVariantRateHistory } from '../../types/products.types';

export function useAdminProducts() {
  return useQuery<AdminProduct[]>({
    queryKey: ['admin', 'products'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PRODUCTS.GET_ALL);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useVariantRateHistory(variantId: number | null) {
  return useQuery<AdminVariantRateHistory[]>({
    queryKey: ['admin', 'rate-history', variantId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PRODUCTS.GET_RATE_HISTORY, { variant_id: variantId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: variantId !== null,
    staleTime: 30000,
  });
}

export function useProductRateHistory(productId: number | null) {
  return useQuery<AdminVariantRateHistory[]>({
    queryKey: ['admin', 'product-rate-history', productId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.PRODUCTS.GET_RATE_HISTORY, { product_id: productId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: productId !== null,
    staleTime: 10000,
  });
}

