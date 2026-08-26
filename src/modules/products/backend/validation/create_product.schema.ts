import { z } from 'zod';

export const PRODUCT_CATEGORIES = ['Chicken', 'Mutton', 'Seafood', 'Eggs'] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(120),
  category: z.enum(PRODUCT_CATEGORIES, {
    errorMap: () => ({ message: 'Category must be one of: Chicken, Mutton, Seafood, Eggs' }),
  }),
  unit_type: z.enum(['weight', 'piece'], {
    errorMap: () => ({ message: 'Unit type must be weight or piece' }),
  }),
  is_processed_cut: z.number().int().min(0).max(1).optional().default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  unit_type: z.enum(['weight', 'piece']).optional(),
  is_processed_cut: z.number().int().min(0).max(1).optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
