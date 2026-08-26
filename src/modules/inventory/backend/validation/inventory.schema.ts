import { z } from 'zod';

export const AdjustStockSchema = z.object({
  product_variant_id: z.number().int().positive(),
  adjustment_type: z.enum(['stock_in', 'stock_out', 'wastage', 'damage']),
  quantity_grams: z.number().int().positive().nullish(),
  quantity_units: z.number().int().positive().nullish(),
  reason: z.string().min(1, 'Reason is required'),
  adjusted_by: z.number().int().positive(),
}).refine(
  data => (data.quantity_grams !== null && data.quantity_grams !== undefined) !== (data.quantity_units !== null && data.quantity_units !== undefined),
  {
    message: 'Either quantity_grams or quantity_units must be provided, but not both',
    path: ['quantity_grams'],
  }
);

export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;
