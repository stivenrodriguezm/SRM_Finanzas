import { Request, Response } from 'express';
import Debt from '../models/Debt';
import Transaction from '../models/Transaction';
import Account from '../models/Account';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { withTransaction } from '../utils/withTransaction';

export const getDebts = catchAsync(async (req: Request, res: Response) => {
  const debts = await Debt.find({ user: req.user!.id }).sort({ createdAt: -1 });
  res.status(200).json(debts);
});

export const getDebtById = catchAsync(async (req: Request, res: Response) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt) throw new AppError('Deuda no encontrada', 404);
  if (debt.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);
  res.status(200).json(debt);
});

export const getDebtTransactions = catchAsync(async (req: Request, res: Response) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt || debt.user.toString() !== req.user!.id) {
    throw new AppError('Deuda no encontrada o no autorizada', 404);
  }

  // Los abonos nuevos quedan ligados por `debt` (ver Transaction.ts). El $or de abajo
  // conserva visibles los abonos históricos que se crearon antes de esa relación y que
  // solo se pueden identificar por texto — se pueden migrar con scripts/migrateDebtTransactions.ts.
  const transactions = await Transaction.find({
    user: req.user!.id,
    type: 'abono_deuda',
    $or: [
      { debt: debt._id },
      { debt: { $exists: false }, title: { $regex: debt.name, $options: 'i' } },
    ],
  })
    .populate('account', 'name color icon')
    .sort({ date: -1 });

  res.status(200).json(transactions);
});

export const setDebt = catchAsync(async (req: Request, res: Response) => {
  const { name, totalAmount, type, dueDate, color, icon, isActive, description } = req.body;

  const debt = await Debt.create({
    user: req.user!.id,
    name: name.trim(),
    totalAmount,
    remainingAmount: totalAmount,
    type,
    color: color || (type === 'debo' ? '#EF4444' : '#10B981'),
    icon: icon || 'person',
    isActive: isActive !== undefined ? isActive : true,
    description: description || '',
    ...(dueDate ? { dueDate } : {}),
  });

  res.status(201).json(debt);
});

export const updateDebt = catchAsync(async (req: Request, res: Response) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt) throw new AppError('Deuda no encontrada', 404);
  if (debt.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const allowedFields = [
    'name', 'type', 'dueDate', 'color', 'icon', 'isActive', 'description', 'totalAmount', 'remainingAmount',
  ] as const;

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  const updated = await Debt.findByIdAndUpdate(req.params.id, { $set: updateData }, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(updated);
});

export const addPayment = catchAsync(async (req: Request, res: Response) => {
  const { amount, accountId, date } = req.body as { amount: number; accountId: string; date?: Date };

  const debt = await Debt.findById(req.params.id);
  if (!debt || debt.user.toString() !== req.user!.id) {
    throw new AppError('Deuda no encontrada o no autorizada', 404);
  }

  const account = await Account.findById(accountId);
  if (!account || account.user.toString() !== req.user!.id) {
    throw new AppError('Cuenta no encontrada o no autorizada', 404);
  }

  const result = await withTransaction(async (session) => {
    debt.remainingAmount = Math.max(0, debt.remainingAmount - amount);
    if (debt.remainingAmount === 0) debt.isActive = false;
    await debt.save({ session });

    const [transaction] = await Transaction.create(
      [
        {
          user: req.user!.id,
          account: accountId,
          debt: debt._id,
          title: `Abono a: ${debt.name}`,
          amount,
          type: 'abono_deuda',
          date: date || new Date(),
        },
      ],
      { session }
    );

    // Yo pago una deuda -> sale dinero de mi cuenta. Me pagan -> entra dinero.
    account.balance += debt.type === 'debo' ? -amount : amount;
    await account.save({ session });

    return { debt, transaction };
  });

  res.status(200).json(result);
});

export const deleteDebt = catchAsync(async (req: Request, res: Response) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt) throw new AppError('Deuda no encontrada', 404);
  if (debt.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  await debt.deleteOne();
  res.status(200).json({ id: req.params.id });
});
