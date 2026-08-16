export type TransactionType = 'ingreso' | 'egreso' | 'abono_deuda';
export type DebtType = 'debo' | 'me_deben';
export type ReminderType = 'unico' | 'periodico';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Account {
  _id: string;
  user: string;
  name: string;
  balance: number;
  color: string;
  icon: string;
  isLiability: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Cuando una transacción viene con `.populate('account', ...)` desde el backend. */
export interface AccountRef {
  _id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Transaction {
  _id: string;
  user: string;
  account: AccountRef;
  reminder?: string;
  debt?: string;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  _id: string;
  user: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  type: DebtType;
  dueDate?: string;
  color: string;
  icon: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderNotificationMode = 'default' | 'escalating' | 'off';

export interface ReminderNotificationConfig {
  mode: ReminderNotificationMode;
  daysBefore: number;
  hour: number;
  startHour: number;
  endHour: number;
  initialIntervalMinutes: number;
  minIntervalMinutes: number;
}

export interface Reminder {
  _id: string;
  user: string;
  title: string;
  date: string;
  type: ReminderType;
  amount?: number;
  isPaid: boolean;
  paymentLink?: string;
  description?: string;
  dayOfMonth?: number;
  notificationConfig?: ReminderNotificationConfig;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: ThemePreference;
  hideAmounts: boolean;
  accountOrder: string[];
  selectedAccounts: string[];
}

export interface AuthUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  preferences: UserPreferences;
}

export interface AuthResponse extends AuthUser {
  token: string;
}
