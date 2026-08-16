import { computeNotificationTriggers } from './reminderNotificationSchedule';
import { Reminder } from '../types/models';

const baseReminder: Reminder = {
  _id: 'r1',
  user: 'u1',
  title: 'Netflix',
  date: new Date().toISOString(),
  type: 'unico',
  isPaid: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const at = (base: Date, dayOffset: number, hour: number, minute = 0): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe('computeNotificationTriggers', () => {
  const now = new Date(2026, 0, 10, 7, 0, 0); // 10 de enero 2026, 7:00am

  it('recordatorio pagado no genera avisos', () => {
    const reminder: Reminder = { ...baseReminder, isPaid: true };
    expect(computeNotificationTriggers(reminder, now)).toEqual([]);
  });

  it('modo off no genera avisos', () => {
    const reminder: Reminder = {
      ...baseReminder,
      notificationConfig: { mode: 'off', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    expect(computeNotificationTriggers(reminder, now)).toEqual([]);
  });

  it('modo default: un único aviso a daysBefore/hour configurados', () => {
    const due = at(now, 5, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      amount: 50000,
      notificationConfig: { mode: 'default', daysBefore: 2, hour: 14, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].date).toEqual(at(now, 3, 14));
    expect(triggers[0].body).toContain('Vence en 2 días');
    expect(triggers[0].body).toContain('$50.000');
  });

  it('modo default: no genera aviso si la fecha de disparo ya pasó', () => {
    const due = at(now, 0, 10); // vence hoy más tarde
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      notificationConfig: { mode: 'default', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    expect(computeNotificationTriggers(reminder, now)).toEqual([]);
  });

  it('modo escalating: vencimiento lejano cae a un único aviso el día antes', () => {
    const due = at(now, 5, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].date).toEqual(at(now, 4, 8));
  });

  it('modo escalating: recordatorio que vence hoy arma la cascada 2h -> 1h con piso en 1h', () => {
    const due = at(now, 0, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    const hours = triggers.map((t) => t.date.getHours());
    expect(hours).toEqual([8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(triggers[0].body).toContain('Vence hoy');
    expect(triggers[1].body).toContain('Sigue pendiente de pago');
  });

  it('modo escalating: con piso de 30 min la cascada llega a intervalos de media hora', () => {
    const due = at(now, 0, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 30 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    const gapsMinutes = triggers.slice(1).map((t, i) => (t.date.getTime() - triggers[i].date.getTime()) / 60000);
    expect(gapsMinutes[0]).toBe(120); // 8:00 -> 10:00
    expect(gapsMinutes[1]).toBe(60); // 10:00 -> 11:00
    expect(gapsMinutes[gapsMinutes.length - 1]).toBe(30); // ya en el piso al final del día
    expect(triggers[triggers.length - 1].date).toEqual(at(now, 0, 21));
  });

  it('modo escalating: recordatorio vencido insiste hoy con el mensaje de vencido', () => {
    const due = at(now, -3, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    expect(triggers[0].body).toContain('Vencido hace 3 días');
  });

  it('modo escalating: snoozedUntil futuro tiene prioridad sobre la fecha real y agenda ese día completo', () => {
    const due = at(now, 10, 0); // vencimiento lejano
    const snoozedUntil = at(now, 2, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      snoozedUntil: snoozedUntil.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    expect(triggers.length).toBeGreaterThan(1);
    expect(triggers[0].date.getDate()).toBe(snoozedUntil.getDate());
    expect(triggers[0].body).toContain('Vence en 8 días');
  });

  it('modo escalating: snoozedUntil en el pasado se ignora', () => {
    const due = at(now, 10, 0);
    const snoozedUntil = at(now, -1, 0);
    const reminder: Reminder = {
      ...baseReminder,
      date: due.toISOString(),
      snoozedUntil: snoozedUntil.toISOString(),
      notificationConfig: { mode: 'escalating', daysBefore: 1, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 },
    };
    const triggers = computeNotificationTriggers(reminder, now);
    expect(triggers).toHaveLength(1); // vuelve al fallback de aviso único (vencimiento lejano)
  });
});
