import cron from 'node-cron';
import { Types } from 'mongoose';
import User from '../models/User';
import Account from '../models/Account';
import MonthlyClosing, { IAccountSnapshot } from '../models/MonthlyClosing';
import { DEFAULT_CLOSING_TIMEZONE, effectiveClosingDay, formatPeriod, nowInTimeZone } from './monthlyClosingSchedule';

const CLOSING_TIMEZONE = process.env.CLOSING_TIMEZONE || DEFAULT_CLOSING_TIMEZONE;

const buildSnapshot = async (userId: Types.ObjectId | string): Promise<{ accounts: IAccountSnapshot[]; netWorth: number }> => {
  const accounts = await Account.find({ user: userId });
  const snapshot: IAccountSnapshot[] = accounts.map((a) => ({
    account: a._id,
    name: a.name,
    color: a.color,
    icon: a.icon,
    isLiability: a.isLiability,
    balance: a.balance,
  }));
  const netWorth = snapshot.reduce((sum, a) => sum + (a.isLiability ? -a.balance : a.balance), 0);
  return { accounts: snapshot, netWorth };
};

/**
 * Crea el cierre de `period` para `userId` si todavía no existe. Idempotente: nunca pisa un cierre
 * ya capturado (automático o editado a mano) — la reusan tanto el endpoint manual como el cron.
 */
export const captureClosing = async (
  userId: Types.ObjectId | string,
  period: string,
  date: Date,
  isAutomatic: boolean
) => {
  const existing = await MonthlyClosing.findOne({ user: userId, period });
  if (existing) return { closing: existing, created: false };

  const { accounts, netWorth } = await buildSnapshot(userId);
  const closing = await MonthlyClosing.create({ user: userId, period, date, accounts, netWorth, isAutomatic });
  return { closing, created: true };
};

/** Recorre los usuarios con día de cierre configurado y captura el cierre de hoy si corresponde. */
export const runMonthlyClosingCheck = async (): Promise<void> => {
  const { year, month, day } = nowInTimeZone(CLOSING_TIMEZONE);
  const period = formatPeriod(year, month);
  const date = new Date(year, month - 1, day);

  const users = await User.find({ 'preferences.monthlyClosingDay': { $ne: null } });
  for (const user of users) {
    const chosenDay = user.preferences.monthlyClosingDay;
    if (!chosenDay) continue;
    if (effectiveClosingDay(chosenDay, year, month) !== day) continue;
    try {
      await captureClosing(user._id, period, date, true);
    } catch (error) {
      console.error(`Error capturando cierre mensual automático para el usuario ${user.id}:`, error);
    }
  }
};

/** Arranca el chequeo diario del cierre automático. Llamar solo desde server.ts (no desde app.ts/tests). */
export const startMonthlyClosingScheduler = (): void => {
  cron.schedule('0 6 * * *', () => {
    runMonthlyClosingCheck().catch((error) => console.error('Error en el chequeo de cierre mensual:', error));
  }, { timezone: CLOSING_TIMEZONE });
};
