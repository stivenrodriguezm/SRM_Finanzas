import { z } from 'zod';

export const createDebtSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  totalAmount: z.coerce.number().positive('El monto total debe ser un número positivo'),
  type: z.enum(['debo', 'me_deben']),
  dueDate: z.coerce.date().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

export const updateDebtSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(['debo', 'me_deben']).optional(),
  dueDate: z.coerce.date().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
  totalAmount: z.coerce.number().positive().optional(),
  remainingAmount: z.coerce.number().min(0).optional(),
});

export const addPaymentSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser un número positivo'),
  accountId: z.string().min(1, 'La cuenta es requerida'),
  date: z.coerce.date().optional(),
});
