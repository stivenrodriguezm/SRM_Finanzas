import { Request, Response } from 'express';
import Reminder from '../models/Reminder';
import Transaction from '../models/Transaction';
import Account from '../models/Account';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { withTransaction } from '../utils/withTransaction';
import { balanceDelta } from '../utils/balanceDelta';

export const getReminders = catchAsync(async (req: Request, res: Response) => {
  const reminders = await Reminder.find({ user: req.user!.id }).sort({ date: 1 });
  res.status(200).json(reminders);
});

export const getReminderById = catchAsync(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);
  res.status(200).json(reminder);
});

export const setReminder = catchAsync(async (req: Request, res: Response) => {
  const { title, date, type, amount, isPaid, paymentLink, description, dayOfMonth, notificationConfig, snoozedUntil } =
    req.body;

  let reminderDate = date;
  if (type === 'periodico' && !date && dayOfMonth) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    // Solo avanzar al mes siguiente si el día ya pasó estrictamente (no si es hoy)
    if (nextDate < todayStart) nextDate.setMonth(nextDate.getMonth() + 1);
    reminderDate = nextDate;
  }

  const reminder = await Reminder.create({
    user: req.user!.id,
    title: title.trim(),
    date: reminderDate,
    type,
    amount,
    isPaid: isPaid !== undefined ? isPaid : false,
    paymentLink,
    description,
    dayOfMonth,
    notificationConfig,
    snoozedUntil,
  });

  res.status(201).json(reminder);
});

export const updateReminder = catchAsync(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  // Nunca permitir que un PUT de edición cambie el estado de pago.
  // isPaid solo se modifica a través de /mark-paid y /pay.
  delete req.body.isPaid;

  if (req.body.notificationConfig) {
    const rawConfig = reminder.notificationConfig as any;
    const existingConfig = rawConfig && typeof rawConfig.toObject === 'function'
      ? rawConfig.toObject()
      : (rawConfig || {});
    reminder.notificationConfig = {
      ...existingConfig,
      ...req.body.notificationConfig,
    };
    delete req.body.notificationConfig;
  }

  Object.assign(reminder, req.body);
  await reminder.save();

  res.status(200).json(reminder);
});

export const markReminderPaid = catchAsync(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  reminder.isPaid = true;
  reminder.snoozedUntil = undefined;

  if (reminder.type === 'periodico' && reminder.dayOfMonth) {
    // Avanzar SIEMPRE desde la fecha original del recordatorio, no desde hoy.
    // Así un pago atrasado no desplaza el próximo ciclo.
    const originalDue = new Date(reminder.date);
    reminder.date = new Date(originalDue.getFullYear(), originalDue.getMonth() + 1, reminder.dayOfMonth);
    reminder.isPaid = false;
  }

  await reminder.save();
  res.status(200).json(reminder);
});

export const deleteReminder = catchAsync(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  await reminder.deleteOne();
  res.status(200).json({ id: req.params.id });
});

export const payReminder = catchAsync(async (req: Request, res: Response) => {
  const { amount, accountId } = req.body as { amount: number; accountId: string };

  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const account = await Account.findById(accountId);
  if (!account) throw new AppError('Cuenta no encontrada', 404);
  if (account.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const result = await withTransaction(async (session) => {
    const [transaction] = await Transaction.create(
      [
        {
          user: req.user!.id,
          account: accountId,
          reminder: reminder._id,
          title: `Pago: ${reminder.title}`,
          amount,
          type: 'egreso',
          date: new Date(),
        },
      ],
      { session }
    );

    account.balance += balanceDelta('egreso', amount, account.isLiability);
    await account.save({ session });

    reminder.snoozedUntil = undefined;

    if (reminder.type === 'unico') {
      reminder.isPaid = true;
    } else if (reminder.type === 'periodico') {
      // Avanzar SIEMPRE desde la fecha original de vencimiento del recordatorio.
      // Si el usuario pagó tarde (ej: debía el día 15, pagó el 18), el próximo
      // recordatorio igualmente queda para el 15 del mes siguiente, no para el 18.
      const originalDue = new Date(reminder.date);
      const day = reminder.dayOfMonth || originalDue.getDate();
      reminder.date = new Date(originalDue.getFullYear(), originalDue.getMonth() + 1, day);
    }
    await reminder.save({ session });

    return { transaction, reminder };
  });

  res.status(200).json({ message: 'Pago registrado exitosamente', ...result });
});

export const getReminderPayments = catchAsync(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw new AppError('Recordatorio no encontrado', 404);
  if (reminder.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const payments = await Transaction.find({ reminder: req.params.id })
    .populate('account', 'name color icon')
    .sort({ date: -1 });

  res.status(200).json(payments);
});
