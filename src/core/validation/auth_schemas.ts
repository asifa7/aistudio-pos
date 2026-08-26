import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required').max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;
