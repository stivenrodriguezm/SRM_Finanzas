import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Transaction, { TransactionType } from '../models/Transaction';
import Account from '../models/Account';
import Debt from '../models/Debt';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { withTransaction } from '../utils/withTransaction';
import { balanceDelta } from '../utils/balanceDelta';

export const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const transactions = await Transaction.find({ user: req.user!.id })
    .populate('account', 'name color icon')
    .sort({ date: -1 });
  res.status(200).json(transactions);
});

export const setTransaction = catchAsync(async (req: Request, res: Response) => {
  const { account, title, amount, type, date } = req.body as {
    account: string;
    title: string;
    amount: number;
    type: TransactionType;
    date?: Date;
  };

  const userAccount = await Account.findById(account);
  if (!userAccount || userAccount.user.toString() !== req.user!.id) {
    throw new AppError('Cuenta no encontrada o no autorizada', 404);
  }

  const created = await withTransaction(async (session) => {
    const [transaction] = await Transaction.create(
      [{ user: req.user!.id, account, title, amount, type, date: date || new Date() }],
      { session }
    );

    userAccount.balance += balanceDelta(type, amount, userAccount.isLiability);
    await userAccount.save({ session });

    return transaction;
  });

  const populated = await Transaction.findById(created._id).populate('account', 'name color icon');
  res.status(201).json(populated);
});

/**
 * Edita título/monto/fecha/cuenta de una transacción existente, recalculando
 * el balance de la(s) cuenta(s) involucradas (y el remainingAmount de la deuda
 * si es un abono). El tipo (ingreso/egreso/abono_deuda) no se puede cambiar aquí.
 */
export const updateTransaction = catchAsync(async (req: Request, res: Response) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) throw new AppError('Transacción no encontrada', 404);
  if (transaction.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const { account: newAccountId, title, amount, date } = req.body as {
    account?: string;
    title?: string;
    amount?: number;
    date?: Date;
  };

  const oldAccountId = transaction.account.toString();
  const targetAccountId = newAccountId && newAccountId !== oldAccountId ? newAccountId : oldAccountId;

  if (targetAccountId !== oldAccountId) {
    const target = await Account.findById(targetAccountId);
    if (!target || target.user.toString() !== req.user!.id) {
      throw new AppError('Cuenta no encontrada o no autorizada', 404);
    }
  }

  const oldAmount = transaction.amount;
  const newAmount = amount ?? oldAmount;

  const updated = await withTransaction(async (session) => {
    const oldAccount = await Account.findById(oldAccountId).session(session);
    if (!oldAccount) throw new AppError('Cuenta original no encontrada', 404);

    if (targetAccountId === oldAccountId) {
      oldAccount.balance +=
        -balanceDelta(transaction.type, oldAmount, oldAccount.isLiability) +
        balanceDelta(transaction.type, newAmount, oldAccount.isLiability);
      await oldAccount.save({ session });
    } else {
      oldAccount.balance -= balanceDelta(transaction.type, oldAmount, oldAccount.isLiability);
      await oldAccount.save({ session });

      const newAccount = await Account.findById(targetAccountId).session(session);
      if (!newAccount) throw new AppError('Cuenta destino no encontrada', 404);
      newAccount.balance += balanceDelta(transaction.type, newAmount, newAccount.isLiability);
      await newAccount.save({ session });
    }

    if (transaction.type === 'abono_deuda' && transaction.debt) {
      const debt = await Debt.findById(transaction.debt).session(session);
      if (debt) {
        debt.remainingAmount = Math.max(0, debt.remainingAmount + oldAmount - newAmount);
        debt.isActive = debt.remainingAmount > 0;
        await debt.save({ session });
      }
    }

    if (title !== undefined) transaction.title = title;
    if (amount !== undefined) transaction.amount = amount;
    if (date !== undefined) transaction.date = date;
    if (newAccountId) transaction.account = new Types.ObjectId(newAccountId);

    await transaction.save({ session });
    return transaction;
  });

  const populated = await Transaction.findById(updated._id).populate('account', 'name color icon');
  res.status(200).json(populated);
});

export const deleteTransaction = catchAsync(async (req: Request, res: Response) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) throw new AppError('Transacción no encontrada', 404);
  if (transaction.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  await withTransaction(async (session) => {
    const account = await Account.findById(transaction.account).session(session);
    if (account) {
      account.balance -= balanceDelta(transaction.type, transaction.amount, account.isLiability);
      await account.save({ session });
    }

    if (transaction.type === 'abono_deuda' && transaction.debt) {
      const debt = await Debt.findById(transaction.debt).session(session);
      if (debt) {
        debt.remainingAmount += transaction.amount;
        debt.isActive = true;
        await debt.save({ session });
      }
    }

    await transaction.deleteOne({ session });
  });

  res.status(200).json({ id: req.params.id });
});
