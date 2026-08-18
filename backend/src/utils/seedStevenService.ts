import bcrypt from 'bcryptjs';
import User from '../models/User';
import Account, { IAccount } from '../models/Account';
import Transaction from '../models/Transaction';
import Debt, { IDebt } from '../models/Debt';
import Reminder from '../models/Reminder';
import MonthlyClosing from '../models/MonthlyClosing';
import AiChat from '../models/AiChat';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

interface TxDraft {
  user: unknown;
  account: unknown;
  debt?: unknown;
  title: string;
  amount: number;
  type: 'ingreso' | 'egreso' | 'abono_deuda';
  date: Date;
}

/**
 * Puebla la cuenta de demo steven@gmail.com con un dataset grande y coherente:
 * ~2.5 años de historia (enero 2024 - agosto 2026), 9 cuentas, 6 deudas, 9 recordatorios,
 * ~650 transacciones variadas y 31 cierres mensuales. Es la ÚNICA fuente de esta lógica —
 * scripts/seedStevenAccount.ts y tests/seedSteven.test.ts solo la invocan, para que no se
 * desincronicen entre sí (ver PROYECTO.md).
 */
export const seedStevenAccount = async () => {
  const email = 'steven@gmail.com';
  const plainPassword = 'Lottus123';

  console.log(`🌱 [Seed] Iniciando población para ${email}...`);

  let user = await User.findOne({ email });
  if (user) {
    console.log(`🧹 Limpiando colecciones anteriores de ${email}...`);
    await Promise.all([
      Account.deleteMany({ user: user._id }),
      Transaction.deleteMany({ user: user._id }),
      Debt.deleteMany({ user: user._id }),
      Reminder.deleteMany({ user: user._id }),
      MonthlyClosing.deleteMany({ user: user._id }),
      AiChat.deleteMany({ user: user._id }),
    ]);
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const preferences = {
    theme: 'dark' as const,
    hideAmounts: false,
    accountOrder: [],
    selectedAccounts: [],
    reminderOrder: [],
    debtOrder: [],
    monthlyClosingDay: 1,
  };

  if (!user) {
    user = await User.create({ name: 'Steven Rodríguez', username: 'steven.rodriguez', email, password: hashedPassword, preferences });
  } else {
    user.name = 'Steven Rodríguez';
    user.username = 'steven.rodriguez';
    user.password = hashedPassword;
    user.preferences = preferences;
    await user.save();
  }

  const userId = user._id;

  // ─────────────────────────── 1. Cuentas ───────────────────────────
  const accountsData = [
    { user: userId, name: 'Bancolombia Ahorros', balance: 6850000, color: '#10B981', icon: 'wallet', isLiability: false, description: 'Cuenta principal para nómina y ahorros' },
    { user: userId, name: 'Davivienda Nómina', balance: 3450000, color: '#EF4444', icon: 'card', isLiability: false, description: 'Cuenta secundaria para gastos operativos' },
    { user: userId, name: 'Nu Bank Ahorros', balance: 15600000, color: '#8B5CF6', icon: 'cash', isLiability: false, description: 'Fondo de emergencia con rendimientos diarios' },
    { user: userId, name: 'Billetera / Efectivo', balance: 380000, color: '#F59E0B', icon: 'cash-outline', isLiability: false, description: 'Efectivo en mano para imprevistos diarios' },
    { user: userId, name: 'Fondo de Inversión Skandia', balance: 21500000, color: '#06B6D4', icon: 'trending-up', isLiability: false, description: 'Portafolio de renta fija + variable a largo plazo' },
    { user: userId, name: 'Ahorro Vacaciones', balance: 2150000, color: '#FBBF24', icon: 'airplane', isLiability: false, description: 'Meta de ahorro para el viaje de fin de año' },
    { user: userId, name: 'Tarjeta de Crédito Visa', balance: 1650000, color: '#3B82F6', icon: 'card-outline', isLiability: true, description: 'Cupo utilizado en compras y viajes' },
    { user: userId, name: 'Tarjeta de Crédito Nu', balance: 480000, color: '#EC4899', icon: 'card', isLiability: true, description: 'Compras a cuotas cortas' },
    { user: userId, name: 'Tarjeta de Crédito Falabella', balance: 890000, color: '#14B8A6', icon: 'card', isLiability: true, description: 'Compras en Falabella y CMR Puntos' },
  ];

  const createdAccounts = await Account.insertMany(accountsData);
  const byName = (needle: string): IAccount => createdAccounts.find((a) => a.name.includes(needle))!;
  const accBancolombia = byName('Bancolombia');
  const accDavivienda = byName('Davivienda');
  const accNuBank = byName('Nu Bank Ahorros');
  const accEfectivo = byName('Billetera');
  const accFondo = byName('Fondo de Inversión');
  const accVacaciones = byName('Ahorro Vacaciones');
  const accVisa = byName('Visa');
  const accNuCredit = byName('Tarjeta de Crédito Nu');
  const accFalabella = byName('Falabella');

  // ─────────────────────────── 2. Deudas / Me deben ───────────────────────────
  const debtsData = [
    { user: userId, name: 'Préstamo Vehicular Banco de Bogotá', totalAmount: 32000000, remainingAmount: 11200000, type: 'debo' as const, dueDate: new Date('2028-01-15'), color: '#EF4444', icon: 'car', isActive: true, description: 'Financiamiento de automóvil a 48 meses' },
    { user: userId, name: 'Préstamo Personal Banco Popular', totalAmount: 4000000, remainingAmount: 1000000, type: 'debo' as const, dueDate: new Date('2027-03-15'), color: '#F59E0B', icon: 'cash', isActive: true, description: 'Crédito de libre inversión para remodelación del apartamento' },
    { user: userId, name: 'Préstamo Estudiantil ICETEX', totalAmount: 9000000, remainingAmount: 4200000, type: 'debo' as const, dueDate: new Date('2029-06-30'), color: '#7C3AED', icon: 'school', isActive: true, description: 'Financiamiento de especialización, cuota mensual fija' },
    { user: userId, name: 'Préstamo a Carlos Gómez', totalAmount: 2500000, remainingAmount: 300000, type: 'me_deben' as const, dueDate: new Date('2026-11-30'), color: '#10B981', icon: 'person', isActive: true, description: 'Préstamo personal a cuotas, casi saldado' },
    { user: userId, name: 'Préstamo a Hermana Laura', totalAmount: 1800000, remainingAmount: 1000000, type: 'me_deben' as const, dueDate: new Date('2027-01-31'), color: '#22C55E', icon: 'person', isActive: true, description: 'Apoyo para matrícula universitaria, pagos parciales' },
    { user: userId, name: 'Proyecto Freelance TechCorp', totalAmount: 3200000, remainingAmount: 3200000, type: 'me_deben' as const, dueDate: new Date('2026-08-31'), color: '#3B82F6', icon: 'briefcase', isActive: true, description: 'Entrega final del rediseño UI/UX de plataforma web, aún sin cobrar' },
  ];

  const createdDebts = await Debt.insertMany(debtsData);
  const byDebtName = (needle: string): IDebt => createdDebts.find((d) => d.name.includes(needle))!;
  const debtCar = byDebtName('Vehicular');
  const debtPersonal = byDebtName('Banco Popular');
  const debtIcetex = byDebtName('ICETEX');
  const debtCarlos = byDebtName('Carlos');
  const debtLaura = byDebtName('Laura');

  // ─────────────────────────── 3. Recordatorios ───────────────────────────
  const defaultNotif = { mode: 'default' as const, daysBefore: 2, hour: 9, startHour: 8, endHour: 21, initialIntervalMinutes: 120, minIntervalMinutes: 60 };
  const escalatingNotif = { mode: 'escalating' as const, daysBefore: 1, hour: 8, startHour: 8, endHour: 20, initialIntervalMinutes: 90, minIntervalMinutes: 30 };

  const remindersData = [
    { user: userId, title: 'Pago Arriendo Apartamento', date: new Date('2026-09-05'), type: 'periodico' as const, amount: 1800000, isPaid: false, dayOfMonth: 5, description: 'Transferencia mensual al arrendador', notificationConfig: defaultNotif },
    { user: userId, title: 'Cuota Préstamo Vehicular', date: new Date('2026-08-25'), type: 'periodico' as const, amount: 650000, isPaid: false, dayOfMonth: 25, description: 'Débito automático cuenta de ahorros', notificationConfig: escalatingNotif },
    { user: userId, title: 'Servicios Públicos (EPM + Internet)', date: new Date('2026-08-20'), type: 'periodico' as const, amount: 320000, isPaid: false, dayOfMonth: 20, description: 'Luz, agua, gas y fibra óptica 500MB', notificationConfig: defaultNotif },
    { user: userId, title: 'Pago Tarjeta de Crédito Nu', date: new Date('2026-08-28'), type: 'periodico' as const, amount: 250000, isPaid: false, dayOfMonth: 28, description: 'Pago mínimo o total de la tarjeta', notificationConfig: escalatingNotif },
    { user: userId, title: 'Mantenimiento Técnico Carro (Cambio Aceite)', date: new Date('2026-08-30'), type: 'unico' as const, amount: 450000, isPaid: false, description: 'Revisión de 30,000 KM en concesionario', notificationConfig: defaultNotif },
    { user: userId, title: 'Pago Tarjeta Falabella', date: new Date('2026-09-15'), type: 'periodico' as const, amount: 180000, isPaid: false, dayOfMonth: 15, description: 'Pago mínimo CMR Falabella', notificationConfig: defaultNotif },
    { user: userId, title: 'Cuota Préstamo Estudiantil ICETEX', date: new Date('2026-09-10'), type: 'periodico' as const, amount: 150000, isPaid: false, dayOfMonth: 10, description: 'Débito automático', notificationConfig: defaultNotif },
    { user: userId, title: 'Seguro SOAT + Todo Riesgo del Carro', date: new Date('2026-10-01'), type: 'unico' as const, amount: 1200000, isPaid: false, description: 'Renovación anual de pólizas del vehículo', notificationConfig: defaultNotif },
    { user: userId, title: 'Suscripción Gimnasio Smart Fit', date: new Date('2026-09-03'), type: 'periodico' as const, amount: 89000, isPaid: true, dayOfMonth: 3, description: 'Ya pagada este ciclo', notificationConfig: { ...defaultNotif, mode: 'off' as const } },
  ];

  await Reminder.insertMany(remindersData);

  // ─────────────────────────── 4. Transacciones (ene 2024 - ago 2026) ───────────────────────────
  console.log('📊 Generando historial de transacciones 2024-2026...');

  const today = new Date();
  const START_YEAR = 2024;
  const START_MONTH = 0;
  const END_YEAR = today.getFullYear();
  const END_MONTH = today.getMonth();

  const months: { year: number; month: number; index: number; dim: number }[] = [];
  {
    let index = 0;
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const mStart = y === START_YEAR ? START_MONTH : 0;
      const mEnd = y === END_YEAR ? END_MONTH : 11;
      for (let m = mStart; m <= mEnd; m++) {
        // El mes en curso solo tiene días hasta "hoy" — nada de transacciones fechadas a futuro.
        const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
        const dim = isCurrentMonth ? today.getDate() : daysInMonth(y, m);
        months.push({ year: y, month: m, index, dim });
        index++;
      }
    }
  }
  const totalMonths = months.length; // ~32

  const freelanceProjects = [
    'Proyecto Freelance UI Design', 'Freelance Desarrollo Web Frontend', 'Consultoría UX App Móvil',
    'Mantenimiento Web Cliente Recurrente', 'Traducción Técnica de Documentos', 'Asesoría en Producto Digital',
    'Diseño de Marca Restaurante Local', 'Desarrollo de Landing Page a Medida',
  ];

  const transactions: TxDraft[] = [];

  for (const m of months) {
    const { year, month, index, dim } = m;
    const clampDay = (d: number) => Math.min(d, dim);

    const salary = year === 2024 ? 4200000 : year === 2025 ? 4700000 : 5500000;
    const rent = year === 2024 ? 1500000 : year === 2025 ? 1650000 : 1800000;

    // ── Ingresos fijos ──
    transactions.push({ user: userId, account: accBancolombia._id, title: 'Pago Nómina Empresa Tech', amount: salary, type: 'ingreso', date: new Date(year, month, 1, 9, 30) });
    transactions.push({ user: userId, account: accNuBank._id, title: 'Rendimientos Financieros Cuenta Nu', amount: Math.floor(60000 + index * 2500), type: 'ingreso', date: new Date(year, month, clampDay(28), 8, 0) });
    transactions.push({ user: userId, account: accFondo._id, title: 'Rendimiento Fondo de Inversión Skandia', amount: Math.floor(90000 + index * 4200), type: 'ingreso', date: new Date(year, month, clampDay(29), 9, 0) });

    // ── Ingresos variables: freelance cada 2 meses ──
    if (index % 2 === 1) {
      const project = freelanceProjects[Math.floor(index / 2) % freelanceProjects.length];
      transactions.push({ user: userId, account: accNuBank._id, title: project, amount: 900000 + (index % 5) * 150000, type: 'ingreso', date: new Date(year, month, clampDay(18), 15, 0) });
    }

    // ── Primas (junio y diciembre) ──
    if (month === 5) transactions.push({ user: userId, account: accBancolombia._id, title: 'Prima de Servicios (Mitad de Año)', amount: Math.floor(salary * 0.5), type: 'ingreso', date: new Date(year, month, clampDay(15), 10, 0) });
    if (month === 11) transactions.push({ user: userId, account: accBancolombia._id, title: 'Prima de Navidad', amount: Math.floor(salary * 0.5), type: 'ingreso', date: new Date(year, month, clampDay(15), 10, 0) });

    // ── Gastos fijos ──
    transactions.push({ user: userId, account: accBancolombia._id, title: 'Pago Arriendo Apartamento El Poblado', amount: rent, type: 'egreso', date: new Date(year, month, clampDay(5), 10, 15) });
    transactions.push({ user: userId, account: accDavivienda._id, title: 'Servicios Públicos EPM + Fibra Óptica', amount: Math.floor(280000 + (index % 4) * 12000), type: 'egreso', date: new Date(year, month, clampDay(20), 11, 30) });
    transactions.push({ user: userId, account: accNuCredit._id, title: 'Suscripción Netflix + Spotify Premium', amount: 68000, type: 'egreso', date: new Date(year, month, clampDay(10), 5, 0) });
    transactions.push({ user: userId, account: accNuCredit._id, title: 'Suscripción Gimnasio Smart Fit', amount: 89000, type: 'egreso', date: new Date(year, month, clampDay(3), 7, 0) });

    // ── Abonos a deudas propias (recurrentes) ──
    transactions.push({ user: userId, account: accBancolombia._id, debt: debtCar._id, title: 'Cuota Mensual Crédito Carro', amount: 650000, type: 'abono_deuda', date: new Date(year, month, clampDay(25), 15, 0) });
    transactions.push({ user: userId, account: accDavivienda._id, debt: debtIcetex._id, title: 'Cuota Préstamo Estudiantil ICETEX', amount: 150000, type: 'abono_deuda', date: new Date(year, month, clampDay(10), 9, 0) });
    if (year > 2025 || (year === 2025 && month >= 5)) {
      transactions.push({ user: userId, account: accBancolombia._id, debt: debtPersonal._id, title: 'Cuota Préstamo Personal Banco Popular', amount: 200000, type: 'abono_deuda', date: new Date(year, month, clampDay(15), 16, 0) });
    }

    // ── Cobros de deudas a favor ──
    if (index % 3 === 0) transactions.push({ user: userId, account: accNuBank._id, debt: debtCarlos._id, title: 'Abono de Deuda - Carlos Gómez', amount: 200000, type: 'abono_deuda', date: new Date(year, month, clampDay(10), 12, 0) });
    if (index % 4 === 2) transactions.push({ user: userId, account: accEfectivo._id, debt: debtLaura._id, title: 'Abono de Deuda - Hermana Laura', amount: 100000, type: 'abono_deuda', date: new Date(year, month, clampDay(11), 13, 0) });

    // ── Mercado / comestibles ──
    transactions.push({ user: userId, account: accDavivienda._id, title: 'Mercado Principal Carulla', amount: Math.floor(360000 + (index % 3) * 30000), type: 'egreso', date: new Date(year, month, clampDay(3), 17, 45) });
    transactions.push({ user: userId, account: accDavivienda._id, title: 'Mercado Quincenal Éxito', amount: Math.floor(300000 + (index % 4) * 25000), type: 'egreso', date: new Date(year, month, clampDay(16), 18, 20) });
    if (dim >= 27) transactions.push({ user: userId, account: accEfectivo._id, title: 'Frutas y Verduras Plaza de Mercado', amount: 130000 + (index % 3) * 10000, type: 'egreso', date: new Date(year, month, 27, 10, 30) });

    // ── Restaurantes / domicilios ──
    transactions.push({ user: userId, account: accVisa._id, title: 'Cena Restaurante Crepes & Waffles', amount: 120000 + (index % 5) * 8000, type: 'egreso', date: new Date(year, month, clampDay(7), 20, 30) });
    transactions.push({ user: userId, account: accVisa._id, title: 'Almuerzo Ejecutivo & Café', amount: 85000 + (index % 4) * 5000, type: 'egreso', date: new Date(year, month, clampDay(14), 13, 15) });
    transactions.push({ user: userId, account: index % 2 === 0 ? accNuCredit._id : accFalabella._id, title: 'Domicilio Rappi / Comida Rápida', amount: 55000 + (index % 4) * 6000, type: 'egreso', date: new Date(year, month, clampDay(21), 21, 0) });

    // ── Transporte ──
    transactions.push({ user: userId, account: accBancolombia._id, title: 'Tanqueada Gasolina Texaco', amount: 130000 + (index % 3) * 8000, type: 'egreso', date: new Date(year, month, 8, 8, 10) });
    transactions.push({ user: userId, account: accBancolombia._id, title: 'Tanqueada Gasolina & Peajes', amount: 145000 + (index % 4) * 7000, type: 'egreso', date: new Date(year, month, clampDay(22), 19, 0) });
    if (index % 2 === 0) transactions.push({ user: userId, account: accEfectivo._id, title: 'Viajes Uber / InDrive', amount: 45000 + (index % 3) * 8000, type: 'egreso', date: new Date(year, month, clampDay(13), 19, 0) });

    // ── Entretenimiento y compras ──
    transactions.push({ user: userId, account: accEfectivo._id, title: 'Cine Cinecolombia', amount: 65000 + (index % 3) * 5000, type: 'egreso', date: new Date(year, month, clampDay(18), 17, 30) });
    transactions.push({ user: userId, account: accFalabella._id, title: 'Compras Almacén Falabella', amount: 90000 + (index % 5) * 15000, type: 'egreso', date: new Date(year, month, clampDay(12), 16, 0) });
    if (index % 3 === 1) transactions.push({ user: userId, account: accEfectivo._id, title: 'Droguería / Copago EPS', amount: 60000 + (index % 4) * 10000, type: 'egreso', date: new Date(year, month, clampDay(9), 12, 0) });
    if (index % 5 === 3) transactions.push({ user: userId, account: accVisa._id, title: 'Compra Ropa y Calzado', amount: 420000 + (index % 4) * 60000, type: 'egreso', date: new Date(year, month, clampDay(24), 16, 0) });
    if (index % 7 === 4) transactions.push({ user: userId, account: accBancolombia._id, title: 'Escapada de Fin de Semana', amount: 1100000 + (index % 3) * 150000, type: 'egreso', date: new Date(year, month, clampDay(17), 12, 0) });
    if (index % 6 === 5) transactions.push({ user: userId, account: accVisa._id, title: 'Tecnología / Accesorios Electrónicos', amount: 550000 + (index % 4) * 90000, type: 'egreso', date: new Date(year, month, clampDay(19), 15, 20) });

    // ── Aportes a metas de ahorro ──
    if (index % 2 === 0) transactions.push({ user: userId, account: accVacaciones._id, title: 'Aporte Mensual Meta de Ahorro Viaje', amount: 150000 + (index % 3) * 20000, type: 'ingreso', date: new Date(year, month, clampDay(6), 8, 0) });

    // ── Diciembre: temporada navideña ──
    if (month === 11) {
      transactions.push({ user: userId, account: accVisa._id, title: 'Regalos de Navidad Familia', amount: 620000 + (index % 3) * 40000, type: 'egreso', date: new Date(year, month, clampDay(20), 18, 0) });
      transactions.push({ user: userId, account: accEfectivo._id, title: 'Cena de Fin de Año', amount: 280000, type: 'egreso', date: new Date(year, month, clampDay(31), 20, 0) });
    }

    // ── Enero: impuesto vehicular ──
    if (month === 0) transactions.push({ user: userId, account: accBancolombia._id, title: 'Impuesto Vehicular Anual', amount: 480000 + (year - START_YEAR) * 30000, type: 'egreso', date: new Date(year, month, clampDay(20), 14, 0) });

    // ── Marzo: declaración de renta ──
    if (month === 2) transactions.push({ user: userId, account: accBancolombia._id, title: 'Pago Saldo Declaración de Renta', amount: 350000 + (year - START_YEAR) * 40000, type: 'egreso', date: new Date(year, month, clampDay(22), 11, 0) });
  }

  await Transaction.insertMany(transactions);
  console.log(`✅ ${transactions.length} transacciones registradas exitosamente.`);

  // ─────────────────────────── 5. Cierres mensuales (todos los meses pasados) ───────────────────────────
  console.log('📈 Generando cierres mensuales históricos...');

  const closingAccountsMeta = [
    { acc: accBancolombia, start: 2200000, end: 6850000, isLiability: false },
    { acc: accDavivienda, start: 1500000, end: 3450000, isLiability: false },
    { acc: accNuBank, start: 4200000, end: 15600000, isLiability: false },
    { acc: accEfectivo, start: 250000, end: 380000, isLiability: false },
    { acc: accFondo, start: 3000000, end: 21500000, isLiability: false },
    { acc: accVacaciones, start: 400000, end: 2150000, isLiability: false },
    { acc: accVisa, start: 900000, end: 1650000, isLiability: true },
    { acc: accNuCredit, start: 300000, end: 480000, isLiability: true },
    { acc: accFalabella, start: 350000, end: 890000, isLiability: true },
  ];

  // Cierres para todos los meses ya completos (no incluye el mes actual, agosto 2026 — ese lo cierra el usuario desde la UI).
  const closingMonths = months.slice(0, totalMonths - 1);
  const closingsData = closingMonths.map((m, i) => {
    const t = closingMonths.length > 1 ? i / (closingMonths.length - 1) : 1;
    const wiggle = Math.sin(i * 1.3) * 0.03;

    const accountsSnapshot = closingAccountsMeta.map(({ acc, start, end, isLiability }) => {
      const base = lerp(start, end, Math.max(0, Math.min(1, t + wiggle)));
      return {
        account: acc._id,
        name: acc.name,
        color: acc.color,
        icon: acc.icon,
        isLiability,
        balance: Math.max(0, Math.round(base / 1000) * 1000),
      };
    });

    const netWorth = accountsSnapshot.reduce((sum, a) => sum + (a.isLiability ? -a.balance : a.balance), 0);

    return {
      user: userId,
      period: `${m.year}-${String(m.month + 1).padStart(2, '0')}`,
      date: new Date(m.year, m.month, daysInMonth(m.year, m.month)),
      netWorth,
      isAutomatic: true,
      note: `Cierre de ${MONTHS_ES[m.month]} ${m.year}.`,
      accounts: accountsSnapshot,
    };
  });

  // Notas dinámicas comparando contra el mes anterior (sube/baja).
  for (let i = 1; i < closingsData.length; i++) {
    const diff = closingsData[i].netWorth - closingsData[i - 1].netWorth;
    closingsData[i].note = diff >= 0
      ? `Cierre de ${MONTHS_ES[closingMonths[i].month]} ${closingMonths[i].year} — patrimonio neto subió $${diff.toLocaleString('es-CO')} frente al mes anterior.`
      : `Cierre de ${MONTHS_ES[closingMonths[i].month]} ${closingMonths[i].year} — patrimonio neto bajó $${Math.abs(diff).toLocaleString('es-CO')} frente al mes anterior.`;
  }

  await MonthlyClosing.insertMany(closingsData);
  console.log(`✅ ${closingsData.length} cierres mensuales generados (${closingMonths[0].year}-${String(closingMonths[0].month + 1).padStart(2, '0')} a ${closingMonths[closingMonths.length - 1].year}-${String(closingMonths[closingMonths.length - 1].month + 1).padStart(2, '0')}).`);

  // ─────────────────────────── 6. Chats de Análisis IA ───────────────────────────
  await AiChat.insertMany([
    {
      user: userId,
      title: 'Diagnóstico de Ahorro y Capacidad Financiera 2024-2026',
      messages: [
        { role: 'user' as const, text: '¿Cómo ha evolucionado mi patrimonio desde 2024 y qué recomendaciones me das para optimizarlo?', createdAt: new Date('2026-08-10T14:20:00') },
        {
          role: 'model' as const,
          text: `¡Hola Steven! Analicé tus registros de enero de 2024 a agosto de 2026 (2.5 años de historial). Aquí el diagnóstico:

### 📈 Aspectos Positivos
1. **Crecimiento sostenido:** tu patrimonio neto casi se cuadriplicó en 2.5 años, impulsado por tu Fondo de Inversión Skandia y el fondo de emergencia en Nu Bank.
2. **Ingresos diversificados:** salario fijo + proyectos freelance recurrentes cada 2 meses + rendimientos de inversión.
3. **Deudas bajo control:** el préstamo vehicular y el de ICETEX avanzan con cuotas puntuales; el préstamo a Carlos Gómez está casi saldado.

### 💡 Recomendaciones Estratégicas
- **Acelerar el Fondo de Inversión:** con tu excedente mensual, considera aumentar el aporte automático.
- **Meta de ahorro Vacaciones:** vas muy bien, a este ritmo la cumples antes de diciembre.
- **Tarjetas de crédito:** el saldo combinado de Visa, Nu y Falabella ronda los $3M — evalúa consolidarlo en la de menor tasa.`,
          charts: [
            { type: 'line' as const, title: 'Evolución del Patrimonio Neto 2024-2026 (millones COP)', description: 'Tendencia mensual de activos netos', labels: ['Ene 24', 'Jul 24', 'Ene 25', 'Jul 25', 'Ene 26', 'Jul 26'], values: [9.5, 16.8, 24.2, 31.5, 39.1, 45.3] },
            { type: 'pie' as const, title: 'Distribución Principal de Gastos', description: 'Categorías con mayor impacto en tus egresos', labels: ['Arriendo', 'Préstamo Carro', 'Mercado', 'Servicios', 'Entretenimiento/Otros'], values: [39600, 20800, 21400, 9200, 12800] },
          ],
          createdAt: new Date('2026-08-10T14:20:15'),
        },
      ],
    },
    {
      user: userId,
      title: 'Estrategia para Liquidación de Deudas',
      messages: [
        { role: 'user' as const, text: '¿Cuál es el mejor método (avalancha vs bola de nieve) para terminar de pagar mis préstamos y tarjetas de crédito?', createdAt: new Date('2026-08-12T16:00:00') },
        {
          role: 'model' as const,
          text: `Te recomiendo el **Método Avalancha**, priorizando por tasa de interés:

1. **Prioridad 1 (Tarjetas de Crédito):** consolida Visa, Nu y Falabella — el saldo combinado es de casi $3M.
2. **Prioridad 2 (Préstamo Personal Banco Popular):** ya vas por la mitad, con $500,000 extra mensuales lo terminas en 5 meses.
3. **Prioridad 3 (Vehicular e ICETEX):** mantén las cuotas actuales, son plazos largos con tasas razonables.`,
          charts: [{ type: 'bar' as const, title: 'Saldos Pendientes por Deuda (millones COP)', description: 'Comparativa de saldo restante', labels: ['Préstamo Carro', 'ICETEX', 'Personal', 'Tarjetas (3)'], values: [11.2, 4.2, 1.0, 3.0] }],
          createdAt: new Date('2026-08-12T16:00:18'),
        },
      ],
    },
    {
      user: userId,
      title: 'Rendimiento del Fondo de Inversión y Metas de Ahorro',
      messages: [
        { role: 'user' as const, text: '¿Qué tan bien me está yendo con el Fondo de Inversión Skandia y la meta de ahorro para vacaciones?', createdAt: new Date('2026-08-14T10:05:00') },
        {
          role: 'model' as const,
          text: `El Fondo Skandia pasó de $3M a $21.5M en 2.5 años gracias a tus aportes constantes y los rendimientos mensuales — un desempeño sólido.

La meta de "Ahorro Vacaciones" también viene creciendo con tus aportes cada 2 meses y ya casi llega a los $2.2M. A este ritmo, para diciembre tendrías un presupuesto cómodo para el viaje sin tocar el fondo de emergencia.`,
          charts: [{ type: 'line' as const, title: 'Fondo de Inversión Skandia (millones COP)', description: 'Crecimiento del saldo 2024-2026', labels: ['2024', '2025', '2026'], values: [3, 12, 21.5] }],
          createdAt: new Date('2026-08-14T10:05:12'),
        },
      ],
    },
  ]);

  console.log(`✅ [Seed] Población finalizada exitosamente para ${email}`);
  return { email, user, accountsCount: createdAccounts.length, debtsCount: createdDebts.length, remindersCount: remindersData.length, transactionsCount: transactions.length, closingsCount: closingsData.length };
};
