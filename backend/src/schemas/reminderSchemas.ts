import { z } from 'zod';

export const createReminderSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es requerido'),
    date: z.coerce.date().optional(),
    type: z.enum(['unico', 'periodico']),
    amount: z.coerce.number().positive().optional(),
    isPaid: z.boolean().optional(),
    paymentLink: z.string().trim().optional(),
    description: z.string().trim().optional(),
    dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  })
  .refine((data) => data.type !== 'unico' || !!data.date, {
    message: 'La fecha es requerida para recordatorios únicos',
    path: ['date'],
  });

export const updateReminderSchema = z.object({
  title: z.string().trim().min(1).optional(),
  date: z.coerce.date().optional(),
  type: z.enum(['unico', 'periodico']).optional(),
  amount: z.coerce.number().positive().optional(),
  isPaid: z.boolean().optional(),
  paymentLink: z.string().trim().optional(),
  description: z.string().trim().optional(),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
});

export const payReminderSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser un número positivo'),
  accountId: z.string().min(1, 'La cuenta es requerida'),
});
