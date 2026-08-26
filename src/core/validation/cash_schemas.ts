import { z } from 'zod';

export const StartCashSessionSchema = z.object({
  user_id: z.number().int().positive(),
  opening_float_paise: z.number().int().nonnegative(),
});

export type StartCashSessionInput = z.infer<typeof StartCashSessionSchema>;

export const ReconcileCashSessionSchema = z.object({
  session_id: z.number().int().positive(),
  actual_cash_paise: z.number().int().nonnegative(),
  remarks: z.string().nullish(),
});

export type ReconcileCashSessionInput = z.infer<typeof ReconcileCashSessionSchema>;
