import { isAxiosError } from 'axios';

export const getErrorMessage = (error: unknown, fallback = 'Ocurrió un error, intenta de nuevo'): string => {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};
