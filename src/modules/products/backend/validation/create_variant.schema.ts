import { z } from 'zod';

export const createVariantSchema = z.object({
  product_id: z.number().int().positive('Product ID must be a positive integer'),
  variant_name: z.string().min(1, 'Variant name is required').max(120),
  rate_paise: z.number().int().positive('Rate must be a positive integer in paise'),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z.object({
  variant_name: z.string().min(1).max(120).optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
