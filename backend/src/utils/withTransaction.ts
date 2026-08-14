import mongoose from 'mongoose';

/**
 * Ejecuta `fn` dentro de una transacción de MongoDB (multi-documento, ACID).
 * Si `fn` lanza, Mongo revierte todos los cambios hechos con la `session` recibida.
 */
export const withTransaction = async <T>(
  fn: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
};
