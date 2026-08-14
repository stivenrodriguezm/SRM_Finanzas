import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.originalUrl}` });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // Error no esperado (bug, fallo de Mongo, etc.) — nunca se expone el detalle al cliente.
  console.error('Error inesperado:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
};
