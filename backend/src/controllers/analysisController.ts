import { Request, Response } from 'express';
import Account, { IAccount } from '../models/Account';
import Debt from '../models/Debt';
import Transaction, { ITransaction } from '../models/Transaction';
import AiChat from '../models/AiChat';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { generateAiChatReply, AiFinancialPayload, GeminiContent } from '../utils/geminiClient';

const MONTHS_BACK = 12;
const RECENT_TRANSACTIONS_LIMIT = 300;
const KICKOFF_MESSAGE = 'Haz un análisis general de mis finanzas.';

const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const buildMonthlySummary = (transactions: ITransaction[]): AiFinancialPayload['resumenMensual'] => {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthKey(d) });
  }

  return months.map(({ key, label }) => {
    const inMonth = transactions.filter((tx) => monthKey(new Date(tx.date)) === key);
    const ingresos = inMonth.filter((tx) => tx.type === 'ingreso').reduce((s, tx) => s + tx.amount, 0);
    const egresos = inMonth.filter((tx) => tx.type === 'egreso').reduce((s, tx) => s + tx.amount, 0);
    const abonos = inMonth.filter((tx) => tx.type === 'abono_deuda').reduce((s, tx) => s + tx.amount, 0);
    return { mes: label, ingresos, egresos, abonos, neto: ingresos - egresos - abonos };
  });
};

/** Recalcula los datos financieros del usuario "en caliente" — se llama en cada turno del chat para
 * que la IA siempre responda con cifras frescas, sin importar cuánto tiempo lleve abierta la conversación. */
const buildFinancialPayload = async (userId: string): Promise<AiFinancialPayload> => {
  const [accounts, debts, transactions] = await Promise.all([
    Account.find({ user: userId }),
    Debt.find({ user: userId, isActive: true }),
    Transaction.find({ user: userId }).sort({ date: -1 }).limit(RECENT_TRANSACTIONS_LIMIT).populate('account', 'name'),
  ]);

  return {
    cuentas: accounts.map((a) => ({ nombre: a.name, balance: a.balance, esDeuda: a.isLiability })),
    deudas: debts.map((d) => ({
      nombre: d.name,
      tipo: d.type,
      total: d.totalAmount,
      restante: d.remainingAmount,
      vence: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : undefined,
    })),
    resumenMensual: buildMonthlySummary(transactions),
    transaccionesRecientes: transactions.map((tx) => ({
      titulo: tx.title,
      monto: tx.amount,
      tipo: tx.type,
      fecha: tx.date.toISOString().slice(0, 10),
      cuenta: (tx.account as unknown as IAccount)?.name || 'Desconocida',
    })),
  };
};

const withFreshData = async (userId: string, message: string): Promise<string> => {
  const payload = await buildFinancialPayload(userId);
  return `Datos financieros actuales del usuario (JSON):\n${JSON.stringify(payload)}\n\n${message}`;
};

const titleFromReply = (reply: string): string => {
  const firstSentence = reply.split(/[.!?\n]/)[0].trim();
  if (!firstSentence) return 'Análisis financiero';
  return firstSentence.length > 60 ? `${firstSentence.slice(0, 57)}…` : firstSentence;
};

export const getAiChats = catchAsync(async (req: Request, res: Response) => {
  const chats = await AiChat.find({ user: req.user!.id }).select('title createdAt updatedAt').sort({ updatedAt: -1 });
  res.status(200).json(chats);
});

export const getAiChatById = catchAsync(async (req: Request, res: Response) => {
  const chat = await AiChat.findById(req.params.id);
  if (!chat) throw new AppError('Chat no encontrado', 404);
  if (chat.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);
  res.status(200).json(chat);
});

export const createAiChat = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const firstTurnText = await withFreshData(userId, KICKOFF_MESSAGE);
  const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: firstTurnText }] }];

  const result = await generateAiChatReply(contents);

  const chat = await AiChat.create({
    user: userId,
    title: titleFromReply(result.reply),
    messages: [
      { role: 'user', text: KICKOFF_MESSAGE, createdAt: new Date() },
      { role: 'model', text: result.reply, charts: result.charts, createdAt: new Date() },
    ],
  });

  res.status(201).json(chat);
});

export const postAiChatMessage = catchAsync(async (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  const chat = await AiChat.findById(req.params.id);
  if (!chat) throw new AppError('Chat no encontrado', 404);
  if (chat.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);

  const history: GeminiContent[] = chat.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const currentTurnText = await withFreshData(req.user!.id, text);
  const contents: GeminiContent[] = [...history, { role: 'user', parts: [{ text: currentTurnText }] }];

  const result = await generateAiChatReply(contents);

  chat.messages.push({ role: 'user', text, createdAt: new Date() });
  chat.messages.push({ role: 'model', text: result.reply, charts: result.charts, createdAt: new Date() });
  await chat.save();

  res.status(200).json(chat);
});

export const deleteAiChat = catchAsync(async (req: Request, res: Response) => {
  const chat = await AiChat.findById(req.params.id);
  if (!chat) throw new AppError('Chat no encontrado', 404);
  if (chat.user.toString() !== req.user!.id) throw new AppError('Usuario no autorizado', 401);
  await chat.deleteOne();
  res.status(200).json({ id: req.params.id });
});
