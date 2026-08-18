/**
 * Lógica pura del cierre mensual (sin DB, sin I/O) — testeable directo con Jest.
 * Mismo espíritu que mobile-app/src/utils/reminderNotificationSchedule.ts.
 */

/** Zona horaria usada si no se configura `CLOSING_TIMEZONE` en el `.env`. */
export const DEFAULT_CLOSING_TIMEZONE = 'America/Bogota';

/** Último día real de un mes (year: completo, month: 1-12). */
export const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

/**
 * Día efectivo de cierre para un mes dado: si el usuario eligió un día que ese mes no tiene
 * (p. ej. 31 en febrero), se usa el último día real del mes.
 */
export const effectiveClosingDay = (chosenDay: number, year: number, month: number): number =>
  Math.min(chosenDay, daysInMonth(year, month));

/** 'YYYY-MM' */
export const formatPeriod = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/** Año/mes/día de "ahora" en una zona horaria IANA dada (ej. 'America/Bogota'), sin depender de la del proceso. */
export const nowInTimeZone = (timeZone: string, now: Date = new Date()): DateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
};
