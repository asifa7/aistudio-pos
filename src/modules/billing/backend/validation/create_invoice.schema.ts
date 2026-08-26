import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  created_by: z.number().int().positive(),
  is_gst_invoice: z.boolean().default(false),
  gst_number_snapshot: z.string().nullish(),
  customer_id: z.number().int().positive().nullish(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const VoidInvoiceSchema = z.object({
  invoice_id: z.number().int().positive(),
  voided_by: z.number().int().positive(),
  void_reason: z.string().min(1, 'Void reason is required'),
});

export type VoidInvoiceInput = z.infer<typeof VoidInvoiceSchema>;

export const ToggleGstSchema = z.object({
  invoice_id: z.number().int().positive(),
  is_gst_invoice: z.boolean(),
  gst_number_snapshot: z.string().nullish(),
});

export type ToggleGstInput = z.infer<typeof ToggleGstSchema>;
