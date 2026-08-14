import { Request, Response } from 'express';
import Account from '../models/Account';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';

export const getAccounts = catchAsync(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { user: req.user!.id };
  if (req.query.isLiability !== undefined) {
    filter.isLiability = req.query.isLiability === 'true';
  }
  const accounts = await Account.find(filter);
  res.status(200).json(accounts);
});

export const setAccount = catchAsync(async (req: Request, res: Response) => {
  const { name, balance, color, icon, isLiability, description } = req.body;

  const account = await Account.create({
    user: req.user!.id,
    name,
    balance: balance || 0,
    color,
    icon,
    isLiability: isLiability || false,
    description: description || '',
  });

  res.status(201).json(account);
});

export const updateAccount = catchAsync(async (req: Request, res: Response) => {
  const account = await Account.findById(req.params.id);
  if (!account) throw new AppError('Cuenta no encontrada', 404);
  if (account.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const updated = await Account.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(updated);
});

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const account = await Account.findById(req.params.id);
  if (!account) throw new AppError('Cuenta no encontrada', 404);
  if (account.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  await account.deleteOne();
  res.status(200).json({ id: req.params.id });
});
