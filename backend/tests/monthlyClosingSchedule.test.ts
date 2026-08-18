import { daysInMonth, effectiveClosingDay, formatPeriod, nowInTimeZone } from '../src/utils/monthlyClosingSchedule';

describe('monthlyClosingSchedule (lógica pura)', () => {
  it('daysInMonth calcula el último día real del mes', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28); // 2026 no es bisiesto
    expect(daysInMonth(2028, 2)).toBe(29); // 2028 sí es bisiesto
  });

  it('effectiveClosingDay respeta el día elegido cuando el mes lo tiene', () => {
    expect(effectiveClosingDay(15, 2026, 8)).toBe(15);
    expect(effectiveClosingDay(1, 2026, 2)).toBe(1);
  });

  it('effectiveClosingDay cae al último día del mes si el elegido no existe ese mes', () => {
    expect(effectiveClosingDay(31, 2026, 4)).toBe(30); // abril tiene 30
    expect(effectiveClosingDay(31, 2026, 2)).toBe(28); // febrero 2026 tiene 28
    expect(effectiveClosingDay(30, 2028, 2)).toBe(29); // febrero 2028 (bisiesto) tiene 29
  });

  it('formatPeriod arma YYYY-MM con el mes en dos dígitos', () => {
    expect(formatPeriod(2026, 8)).toBe('2026-08');
    expect(formatPeriod(2026, 12)).toBe('2026-12');
    expect(formatPeriod(2027, 1)).toBe('2027-01');
  });

  it('nowInTimeZone lee año/mes/día en la zona horaria pedida', () => {
    // 2026-08-17T02:30:00Z es 2026-08-16 21:30 en America/Bogota (UTC-5) — cruza el día.
    const utcDate = new Date('2026-08-17T02:30:00Z');
    expect(nowInTimeZone('America/Bogota', utcDate)).toEqual({ year: 2026, month: 8, day: 16 });
    expect(nowInTimeZone('UTC', utcDate)).toEqual({ year: 2026, month: 8, day: 17 });
  });
});
