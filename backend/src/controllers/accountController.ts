import { Request, Response } from 'express';
import Account from '../models/Account';
import Transaction from '../models/Transaction';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { withTransaction } from '../utils/withTransaction';

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

/** Abono a una cuenta de deuda (isLiability=true) pagado desde otra cuenta propia. */
export const payLiabilityAccount = catchAsync(async (req: Request, res: Response) => {
  const { amount, sourceAccountId, date } = req.body as { amount: number; sourceAccountId: string; date?: Date };

  const liabilityAccount = await Account.findById(req.params.id);
  if (!liabilityAccount || liabilityAccount.user.toString() !== req.user!.id) {
    throw new AppError('Cuenta no encontrada o no autorizada', 404);
  }
  if (!liabilityAccount.isLiability) {
    throw new AppError('Esta cuenta no es una cuenta de deuda', 400);
  }

  if (sourceAccountId === req.params.id) {
    throw new AppError('La cuenta de origen debe ser distinta de la cuenta de deuda', 400);
  }
  const sourceAccount = await Account.findById(sourceAccountId);
  if (!sourceAccount || sourceAccount.user.toString() !== req.user!.id) {
    throw new AppError('Cuenta de origen no encontrada o no autorizada', 404);
  }

  const result = await withTransaction(async (session) => {
    liabilityAccount.balance = Math.max(0, liabilityAccount.balance - amount);
    await liabilityAccount.save({ session });

    sourceAccount.balance -= amount;
    await sourceAccount.save({ session });

    const [transaction] = await Transaction.create(
      [
        {
          user: req.user!.id,
          account: liabilityAccount._id,
          title: `Abono desde: ${sourceAccount.name}`,
          amount,
          type: 'abono_deuda',
          date: date || new Date(),
        },
      ],
      { session }
    );
    await Transaction.create(
      [
        {
          user: req.user!.id,
          account: sourceAccount._id,
          title: `Abono a: ${liabilityAccount.name}`,
          amount,
          type: 'egreso',
          date: date || new Date(),
        },
      ],
      { session }
    );

    return { account: liabilityAccount, transaction };
  });

  res.status(200).json(result);
});

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const account = await Account.findById(req.params.id);
  if (!account) throw new AppError('Cuenta no encontrada', 404);
  if (account.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  await account.deleteOne();
  res.status(200).json({ id: req.params.id });
});
