import { z } from 'zod';

export const UpdateVariantRateSchema = z.object({
  variant_id: z.number().int().positive(),
  new_rate_paise: z.number().int().positive({ message: 'Rate must be a positive integer in paise' }),
  set_by: z.number().int().positive(),
});

export type UpdateVariantRateInput = z.infer<typeof UpdateVariantRateSchema>;

export const CreateVariantSchema = z.object({
  product_id: z.number().int().positive(),
  variant_name: z.string().min(1, 'Variant name is required').max(100),
  current_rate_paise_per_unit: z.number().int().positive({ message: 'Rate must be a positive integer in paise' }),
});

export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
