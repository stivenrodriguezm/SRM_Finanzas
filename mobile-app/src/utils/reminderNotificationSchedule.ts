import { Reminder, ReminderNotificationConfig } from '../types/models';

export interface NotificationTrigger {
  id: string;
  reminderId: string;
  date: Date;
  title: string;
  body: string;
}

export const DEFAULT_NOTIFICATION_CONFIG: ReminderNotificationConfig = {
  mode: 'default',
  daysBefore: 1,
  hour: 9,
  startHour: 8,
  endHour: 21,
  initialIntervalMinutes: 120,
  minIntervalMinutes: 60,
};

// Piso de seguridad por recordatorio ante una configuración extrema (ventana muy larga +
// intervalo mínimo muy chico). El cupo real entre todos los recordatorios lo impone
// MAX_TOTAL_SCHEDULED en services/notifications.ts.
const MAX_TRIGGERS_PER_REMINDER = 60;

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

const formatAmountSuffix = (amount?: number): string => (amount ? ` · $${amount.toLocaleString('es-CO')}` : '');

const dueLabelFor = (diffDays: number): string => {
  if (diffDays > 1) return `Vence en ${diffDays} días`;
  if (diffDays === 1) return 'Vence mañana';
  if (diffDays === 0) return 'Vence hoy';
  const overdue = -diffDays;
  return `Vencido hace ${overdue} día${overdue === 1 ? '' : 's'}`;
};

const buildSingleTrigger = (reminder: Reminder, daysBefore: number, hour: number, now: Date): NotificationTrigger[] => {
  const due = new Date(reminder.date);
  const trigger = new Date(due);
  trigger.setDate(trigger.getDate() - daysBefore);
  trigger.setHours(hour, 0, 0, 0);
  if (trigger.getTime() <= now.getTime()) return [];

  return [
    {
      id: `reminder-${reminder._id}-0`,
      reminderId: reminder._id,
      date: trigger,
      title: reminder.title,
      body: `${dueLabelFor(daysBefore)}${formatAmountSuffix(reminder.amount)}`,
    },
  ];
};

const buildEscalatingTriggers = (reminder: Reminder, config: ReminderNotificationConfig, now: Date): NotificationTrigger[] => {
  const dueDay = startOfDay(new Date(reminder.date));
  const today = startOfDay(now);
  const snoozedDay = reminder.snoozedUntil ? startOfDay(new Date(reminder.snoozedUntil)) : null;

  let activeDay: Date;
  if (snoozedDay && snoozedDay.getTime() >= today.getTime()) {
    activeDay = snoozedDay;
  } else if (dueDay.getTime() <= today.getTime()) {
    // Ya venció o vence hoy: insiste hoy mismo mientras siga sin pagarse.
    activeDay = today;
  } else {
    // El vencimiento todavía está lejos: un único aviso el día antes, como el modo simple,
    // para no gastar cupo de notificaciones en algo que aún no es urgente.
    return buildSingleTrigger(reminder, 1, config.startHour, now);
  }

  const diffToDue = daysBetween(activeDay, dueDay);
  const triggers: NotificationTrigger[] = [];
  const cursor = new Date(activeDay);
  cursor.setHours(config.startHour, 0, 0, 0);
  const endTime = new Date(activeDay);
  endTime.setHours(config.endHour, 0, 0, 0);
  let interval = config.initialIntervalMinutes;
  let index = 0;

  while (cursor.getTime() <= endTime.getTime() && index < MAX_TRIGGERS_PER_REMINDER) {
    if (cursor.getTime() > now.getTime()) {
      const label = index === 0 ? dueLabelFor(diffToDue) : 'Sigue pendiente de pago';
      triggers.push({
        id: `reminder-${reminder._id}-${index}`,
        reminderId: reminder._id,
        date: new Date(cursor),
        title: reminder.title,
        body: `${label}${formatAmountSuffix(reminder.amount)}`,
      });
    }
    cursor.setTime(cursor.getTime() + interval * 60000);
    interval = Math.max(config.minIntervalMinutes, Math.round(interval / 2));
    index++;
  }

  return triggers;
};

/** Calcula los avisos locales pendientes para un recordatorio, dado un instante `now` de referencia. */
export const computeNotificationTriggers = (reminder: Reminder, now: Date = new Date()): NotificationTrigger[] => {
  if (reminder.isPaid) return [];
  const config = reminder.notificationConfig ?? DEFAULT_NOTIFICATION_CONFIG;

  if (config.mode === 'off') return [];
  if (config.mode === 'escalating') return buildEscalatingTriggers(reminder, config, now);
  return buildSingleTrigger(reminder, config.daysBefore, config.hour, now);
};
