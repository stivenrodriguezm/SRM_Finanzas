import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

export const validate = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      next(new AppError(message, 400));
      return;
    }
    req.body = result.data;
    next();
  };
};
