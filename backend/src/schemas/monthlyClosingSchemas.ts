import { z } from 'zod';

export const captureClosingSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El período debe tener el formato YYYY-MM')
    .optional(),
});

export const updateClosingSchema = z.object({
  accounts: z
    .array(
      z.object({
        account: z.string().min(1, 'La cuenta es requerida'),
        balance: z.coerce.number(),
      })
    )
    .min(1, 'Debe incluir al menos una cuenta'),
  note: z.string().optional(),
});
