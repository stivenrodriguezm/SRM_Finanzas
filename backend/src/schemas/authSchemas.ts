import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  username: z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres'),
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  username: z.string().trim().min(3).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  hideAmounts: z.boolean().optional(),
  accountOrder: z.array(z.string()).optional(),
  selectedAccounts: z.array(z.string()).optional(),
  reminderOrder: z.array(z.string()).optional(),
  debtOrder: z.array(z.string()).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});
