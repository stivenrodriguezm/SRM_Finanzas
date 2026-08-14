import { z } from 'zod';

const transactionType = z.enum(['ingreso', 'egreso', 'abono_deuda']);

export const createTransactionSchema = z.object({
  account: z.string().min(1, 'La cuenta es requerida'),
  title: z.string().trim().min(1, 'El título es requerido'),
  amount: z.coerce.number().positive('El monto debe ser un número positivo'),
  type: transactionType,
  date: z.coerce.date().optional(),
});

// El tipo (ingreso/egreso/abono_deuda) no se puede cambiar al editar: un abono a
// deuda está atado a la lógica de remainingAmount y convertirlo sería ambiguo.
// Para cambiar el tipo hay que borrar y crear una transacción nueva.
export const updateTransactionSchema = z.object({
  account: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  amount: z.coerce.number().positive('El monto debe ser un número positivo').optional(),
  date: z.coerce.date().optional(),
});
