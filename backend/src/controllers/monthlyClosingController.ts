import { Request, Response } from 'express';
import MonthlyClosing from '../models/MonthlyClosing';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { captureClosing } from '../utils/monthlyClosingScheduler';
import { DEFAULT_CLOSING_TIMEZONE, effectiveClosingDay, formatPeriod, nowInTimeZone } from '../utils/monthlyClosingSchedule';

const CLOSING_TIMEZONE = process.env.CLOSING_TIMEZONE || DEFAULT_CLOSING_TIMEZONE;

export const getClosings = catchAsync(async (req: Request, res: Response) => {
  const closings = await MonthlyClosing.find({ user: req.user!.id }).sort({ period: -1 });
  res.status(200).json(closings);
});

export const getClosingByPeriod = catchAsync(async (req: Request, res: Response) => {
  const closing = await MonthlyClosing.findOne({ user: req.user!.id, period: req.params.period });
  if (!closing) throw new AppError('Cierre no encontrado', 404);
  res.status(200).json(closing);
});

export const captureNow = catchAsync(async (req: Request, res: Response) => {
  const { period } = req.body as { period?: string };

  let targetPeriod = period;
  let date: Date;
  if (targetPeriod) {
    const [year, month] = targetPeriod.split('-').map(Number);
    const day = effectiveClosingDay(nowInTimeZone(CLOSING_TIMEZONE).day, year, month);
    date = new Date(year, month - 1, day);
  } else {
    const { year, month, day } = nowInTimeZone(CLOSING_TIMEZONE);
    targetPeriod = formatPeriod(year, month);
    date = new Date(year, month - 1, day);
  }

  const { closing, created } = await captureClosing(req.user!.id, targetPeriod, date, false);
  res.status(created ? 201 : 200).json(closing);
});

export const updateClosing = catchAsync(async (req: Request, res: Response) => {
  const { accounts, note } = req.body as { accounts: { account: string; balance: number }[]; note?: string };

  const closing = await MonthlyClosing.findOne({ user: req.user!.id, period: req.params.period });
  if (!closing) throw new AppError('Cierre no encontrado', 404);

  const knownIds = new Set(closing.accounts.map((a) => a.account.toString()));
  for (const entry of accounts) {
    if (!knownIds.has(entry.account)) {
      throw new AppError('Una de las cuentas no pertenece a este cierre', 400);
    }
  }

  const balanceById = new Map(accounts.map((a) => [a.account, a.balance]));
  closing.accounts = closing.accounts.map((a) => ({
    ...a,
    balance: balanceById.has(a.account.toString()) ? balanceById.get(a.account.toString())! : a.balance,
  }));
  closing.netWorth = closing.accounts.reduce((sum, a) => sum + (a.isLiability ? -a.balance : a.balance), 0);
  closing.isAutomatic = false;
  if (note !== undefined) closing.note = note;

  const updated = await closing.save();
  res.status(200).json(updated);
});

export const deleteClosing = catchAsync(async (req: Request, res: Response) => {
  const closing = await MonthlyClosing.findOne({ user: req.user!.id, period: req.params.period });
  if (!closing) throw new AppError('Cierre no encontrado', 404);
  await closing.deleteOne();
  res.status(200).json({ period: req.params.period });
});
