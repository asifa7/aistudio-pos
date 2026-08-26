import { z } from 'zod';

export const RecordPaymentSchema = z.object({
  invoice_id: z.number().int().positive(),
  method: z.enum(['cash', 'upi', 'card', 'split']),
  amount_paise: z.number().int().positive({ message: 'Payment amount must be a positive integer in paise' }),
  reference_number: z.string().nullish(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
