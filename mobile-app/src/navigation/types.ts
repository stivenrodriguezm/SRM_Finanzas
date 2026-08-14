import { NavigationProp } from '@react-navigation/native';
import { Reminder } from '../types/models';

export type TabParamList = {
  Balance: undefined;
  Transacciones: undefined;
  Deudas: undefined;
  Recordatorios: undefined;
  Análisis: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  TabRoot: undefined;
  AddRecord: { initialType?: 'ingreso' | 'gasto' | 'abono_deuda'; preselectedAccount?: string } | undefined;
  AddReminder: { reminder?: Reminder } | undefined;
  ReminderDetail: { reminder: Reminder; dateText: string; isUrgent: boolean };
  Perfil: undefined;
  DebtDetail: {
    id: string;
    title?: string;
    total?: string;
    color?: string;
    icon?: string;
    iconColor?: string;
    iconBg?: string;
    type?: 'debo' | 'me_deben';
  };
  AddDebt: { initialDebtType?: 'debo' | 'me_deben'; isModifyMode?: boolean; id?: string } | undefined;
  Receivables: undefined;
  Preferences: undefined;
  AccountDetail: { accountId: string };
};

/** Tipo pragmático para useNavigation() en pantallas que pueden navegar a rutas de ambos navigators. */
export type AppNavigation = NavigationProp<RootStackParamList & TabParamList>;
