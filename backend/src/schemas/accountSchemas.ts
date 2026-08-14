import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la cuenta es requerido'),
  balance: z.coerce.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isLiability: z.boolean().optional(),
  description: z.string().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();
