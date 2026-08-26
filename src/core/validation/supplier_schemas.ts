import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(120),
  contact: z.string().nullish(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
