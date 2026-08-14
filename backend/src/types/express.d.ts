import { HydratedDocument } from 'mongoose';
import { IUser } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<IUser>;
    }
  }
}

export {};
