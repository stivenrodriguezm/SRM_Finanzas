import { z } from 'zod';

const notificationConfigSchema = z
  .object({
    mode: z.enum(['default', 'escalating', 'off']),
    daysBefore: z.coerce.number().min(0).max(30).optional(),
    hour: z.coerce.number().min(0).max(23).optional(),
    startHour: z.coerce.number().min(0).max(23).optional(),
    endHour: z.coerce.number().min(0).max(23).optional(),
    initialIntervalMinutes: z.coerce.number().min(15).max(720).optional(),
    minIntervalMinutes: z.coerce.number().min(15).max(720).optional(),
  })
  .refine((data) => data.startHour === undefined || data.endHour === undefined || data.endHour > data.startHour, {
    message: 'La hora límite debe ser posterior a la hora de inicio',
    path: ['endHour'],
  })
  .refine(
    (data) =>
      data.minIntervalMinutes === undefined ||
      data.initialIntervalMinutes === undefined ||
      data.minIntervalMinutes <= data.initialIntervalMinutes,
    {
      message: 'El intervalo mínimo no puede ser mayor al intervalo inicial',
      path: ['minIntervalMinutes'],
    }
  );

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
    notificationConfig: notificationConfigSchema.optional(),
    snoozedUntil: z.coerce.date().nullable().optional(),
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
  notificationConfig: notificationConfigSchema.optional(),
  snoozedUntil: z.coerce.date().nullable().optional(),
});

export const payReminderSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser un número positivo'),
  accountId: z.string().min(1, 'La cuenta es requerida'),
});
