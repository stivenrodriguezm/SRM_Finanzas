import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { AppError } from '../utils/AppError';

interface JwtPayload {
  id: string;
}

export const protect = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer')) {
    next(new AppError('No autorizado, no hay token', 401));
    return;
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      next(new AppError('No autorizado, usuario no existe', 401));
      return;
    }
    req.user = user;
    next();
  } catch {
    next(new AppError('No autorizado, token falló', 401));
  }
};
