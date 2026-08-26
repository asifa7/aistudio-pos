import { z } from 'zod';

export const updateRateSchema = z.object({
  variant_id: z.number().int().positive(),
  new_rate_paise: z.number().int().positive('New rate must be a positive integer in paise'),
  set_by: z.number().int().positive().default(1),
});

export type UpdateRateInput = z.infer<typeof updateRateSchema>;
