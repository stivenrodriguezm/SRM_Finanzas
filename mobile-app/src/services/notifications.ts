import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from '../types/models';
import { computeNotificationTriggers } from '../utils/reminderNotificationSchedule';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Tope de notificaciones locales pendientes a la vez (iOS limita ~64 por app). Se prioriza lo
// más próximo en el tiempo: si hay varios recordatorios "insistentes" activos el mismo día, los
// avisos más lejanos se descartan primero.
const MAX_TOTAL_SCHEDULED = 60;

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return finalStatus === 'granted';
};

/** Cancela todos los avisos locales pendientes (esta app no usa notificaciones locales para nada más). */
export const cancelAllReminderNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Recalcula y reprograma desde cero los avisos locales de todos los recordatorios (llamar tras
 * cada fetch de recordatorios, o tras cualquier cambio que afecte su programación: pago,
 * edición, aplazamiento). Idempotente: cancela todo y vuelve a agendar el set completo.
 */
export const syncReminderNotifications = async (reminders: Reminder[], notificationsEnabled: boolean): Promise<void> => {
  await cancelAllReminderNotifications();
  if (!notificationsEnabled) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const now = new Date();
  const triggers = reminders
    .flatMap((reminder) => computeNotificationTriggers(reminder, now))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_TOTAL_SCHEDULED);

  await Promise.all(
    triggers.map((trigger) =>
      Notifications.scheduleNotificationAsync({
        identifier: trigger.id,
        content: {
          title: trigger.title,
          body: trigger.body,
          data: { reminderId: trigger.reminderId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date },
      })
    )
  );
};
