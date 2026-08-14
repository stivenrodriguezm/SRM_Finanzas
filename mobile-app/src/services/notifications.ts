import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from '../types/models';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

const notificationIdFor = (reminderId: string): string => `reminder-${reminderId}`;

export const cancelReminderNotification = async (reminderId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationIdFor(reminderId));
};

/** Programa (o reprograma) un aviso local un día antes del vencimiento, a las 9am. */
export const scheduleReminderNotification = async (reminder: Reminder): Promise<void> => {
  await cancelReminderNotification(reminder._id);
  if (reminder.isPaid) return;

  const dueDate = new Date(reminder.date);
  const triggerDate = new Date(dueDate);
  triggerDate.setDate(triggerDate.getDate() - 1);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: notificationIdFor(reminder._id),
    content: {
      title: reminder.title,
      body: reminder.amount
        ? `Vence mañana · $${reminder.amount.toLocaleString('es-CO')}`
        : 'Vence mañana',
      data: { reminderId: reminder._id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });
};

/** Sincroniza los avisos locales con la lista completa de recordatorios (llamar tras cada fetch). */
export const syncReminderNotifications = async (reminders: Reminder[]): Promise<void> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await Promise.all(reminders.map((r) => scheduleReminderNotification(r)));
};
