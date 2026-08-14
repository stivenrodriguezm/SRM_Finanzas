import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from './apiClient';
import { Account, Transaction, Debt, Reminder } from '../types/models';
import { toCsv } from '../utils/csv';

const writeAndShare = async (fileName: string, content: string, mimeType: string): Promise<void> => {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Exportar datos de Finanzas' });
  }
};

/** Descarga cuentas, transacciones, deudas y recordatorios en un solo JSON (respaldo completo). */
export const exportAllDataAsJson = async (): Promise<void> => {
  const [accounts, transactions, debts, reminders] = await Promise.all([
    apiClient.get<Account[]>('/accounts'),
    apiClient.get<Transaction[]>('/transactions'),
    apiClient.get<Debt[]>('/debts'),
    apiClient.get<Reminder[]>('/reminders'),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    accounts: accounts.data,
    transactions: transactions.data,
    debts: debts.data,
    reminders: reminders.data,
  };

  await writeAndShare(`finanzas-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
};

/** Exporta solo las transacciones en CSV, listo para abrir en Excel/Sheets. */
export const exportTransactionsAsCsv = async (): Promise<void> => {
  const { data } = await apiClient.get<Transaction[]>('/transactions');
  const rows = data.map((tx) => ({
    fecha: tx.date,
    titulo: tx.title,
    tipo: tx.type,
    monto: tx.amount,
    cuenta: tx.account?.name ?? '',
  }));
  const csv = toCsv(['fecha', 'titulo', 'tipo', 'monto', 'cuenta'], rows);
  await writeAndShare(`transacciones-${Date.now()}.csv`, csv, 'text/csv');
};
