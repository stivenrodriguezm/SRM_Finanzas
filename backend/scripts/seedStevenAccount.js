require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

// Definición de Schemas para la población
const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      hideAmounts: { type: Boolean, default: false },
      accountOrder: { type: [String], default: [] },
      selectedAccounts: { type: [String], default: [] },
      reminderOrder: { type: [String], default: [] },
      debtOrder: { type: [String], default: [] },
      monthlyClosingDay: { type: Number, min: 1, max: 31, default: null },
    },
  },
  { timestamps: true }
);

const AccountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
    color: { type: String, default: '#000000' },
    icon: { type: String, default: 'wallet' },
    isLiability: { type: Boolean, default: false },
    description: { type: String },
  },
  { timestamps: true }
);

const TransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    account: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
    reminder: { type: Schema.Types.ObjectId, ref: 'Reminder' },
    debt: { type: Schema.Types.ObjectId, ref: 'Debt' },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: ['ingreso', 'egreso', 'abono_deuda'] },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const DebtSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    type: { type: String, required: true, enum: ['debo', 'me_deben'] },
    dueDate: { type: Date },
    color: { type: String, default: '#EF4444' },
    icon: { type: String, default: 'person' },
    isActive: { type: Boolean, default: true },
    description: { type: String },
  },
  { timestamps: true }
);

const ReminderNotificationConfigSchema = new Schema(
  {
    mode: { type: String, enum: ['default', 'escalating', 'off'], default: 'default' },
    daysBefore: { type: Number, min: 0, max: 30, default: 1 },
    hour: { type: Number, min: 0, max: 23, default: 9 },
    startHour: { type: Number, min: 0, max: 23, default: 8 },
    endHour: { type: Number, min: 0, max: 23, default: 21 },
    initialIntervalMinutes: { type: Number, min: 15, max: 720, default: 120 },
    minIntervalMinutes: { type: Number, min: 15, max: 720, default: 60 },
  },
  { _id: false }
);

const ReminderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, required: true, enum: ['unico', 'periodico'], default: 'unico' },
    amount: { type: Number },
    isPaid: { type: Boolean, default: false },
    paymentLink: { type: String },
    description: { type: String },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    notificationConfig: { type: ReminderNotificationConfigSchema, default: () => ({}) },
    snoozedUntil: { type: Date },
  },
  { timestamps: true }
);

const AccountSnapshotSchema = new Schema(
  {
    account: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
    name: { type: String, required: true },
    color: { type: String, required: true },
    icon: { type: String, required: true },
    isLiability: { type: Boolean, required: true },
    balance: { type: Number, required: true },
  },
  { _id: false }
);

const MonthlyClosingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    period: { type: String, required: true },
    date: { type: Date, required: true },
    netWorth: { type: Number, required: true },
    accounts: { type: [AccountSnapshotSchema], default: [] },
    isAutomatic: { type: Boolean, default: false },
    note: { type: String },
  },
  { timestamps: true }
);

const AiChartSchema = new Schema(
  {
    type: { type: String, enum: ['bar', 'pie', 'line'], required: true },
    title: { type: String, required: true },
    description: { type: String },
    labels: { type: [String], required: true },
    values: { type: [Number], required: true },
  },
  { _id: false }
);

const AiChatMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true },
    charts: { type: [AiChartSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiChatSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    messages: { type: [AiChatMessageSchema], default: [] },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Account = mongoose.models.Account || mongoose.model('Account', AccountSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
const Debt = mongoose.models.Debt || mongoose.model('Debt', DebtSchema);
const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
const MonthlyClosing = mongoose.models.MonthlyClosing || mongoose.model('MonthlyClosing', MonthlyClosingSchema);
const AiChat = mongoose.models.AiChat || mongoose.model('AiChat', AiChatSchema);

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está configurado en .env');
    process.exit(1);
  }

  console.log('🔌 Conectando a MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Conectado exitosamente');

  const email = 'steven@gmail.com';
  const plainPassword = 'Lottus123';

  // 1. Limpiar datos existentes del usuario steven@gmail.com
  let user = await User.findOne({ email });
  if (user) {
    console.log(`🧹 Limpiando datos antiguos de ${email}...`);
    await Promise.all([
      Account.deleteMany({ user: user._id }),
      Transaction.deleteMany({ user: user._id }),
      Debt.deleteMany({ user: user._id }),
      Reminder.deleteMany({ user: user._id }),
      MonthlyClosing.deleteMany({ user: user._id }),
      AiChat.deleteMany({ user: user._id }),
    ]);
  } else {
    console.log(`👤 Creando usuario ${email}...`);
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  if (!user) {
    user = await User.create({
      name: 'Steven Rodríguez',
      username: 'steven.rodriguez',
      email,
      password: hashedPassword,
      preferences: {
        theme: 'dark',
        hideAmounts: false,
        monthlyClosingDay: 1,
      },
    });
  } else {
    user.name = 'Steven Rodríguez';
    user.username = 'steven.rodriguez';
    user.password = hashedPassword;
    user.preferences = {
      theme: 'dark',
      hideAmounts: false,
      accountOrder: [],
      selectedAccounts: [],
      reminderOrder: [],
      debtOrder: [],
      monthlyClosingDay: 1,
    };
    await user.save();
  }

  const userId = user._id;
  console.log(`✅ Usuario configurado: ID ${userId}`);

  // 2. Crear Cuentas
  console.log('🏦 Creando cuentas financieras...');
  const accountsData = [
    {
      name: 'Bancolombia Ahorros',
      balance: 5420000,
      color: '#10B981',
      icon: 'wallet',
      isLiability: false,
      description: 'Cuenta principal para nómina y ahorros',
    },
    {
      name: 'Davivienda Nómina',
      balance: 3180000,
      color: '#EF4444',
      icon: 'card',
      isLiability: false,
      description: 'Cuenta secundaria para gastos operativos',
    },
    {
      name: 'Nu Bank Ahorros',
      balance: 8650000,
      color: '#8B5CF6',
      icon: 'cash',
      isLiability: false,
      description: 'Fondo de emergencia con rendimientos diarios',
    },
    {
      name: 'Billetera / Efectivo',
      balance: 450000,
      color: '#F59E0B',
      icon: 'cash-outline',
      isLiability: false,
      description: 'Efectivo en mano para imprevistos diarios',
    },
    {
      name: 'Tarjeta de Crédito Visa',
      balance: 1850000,
      color: '#3B82F6',
      icon: 'card-outline',
      isLiability: true,
      description: 'Cupo utilizado en compras y viajes',
    },
    {
      name: 'Tarjeta de Crédito Nu',
      balance: 620000,
      color: '#EC4899',
      icon: 'card',
      isLiability: true,
      description: 'Compras a cuotas cortas',
    },
  ];

  const createdAccounts = await Account.insertMany(
    accountsData.map((a) => ({ ...a, user: userId }))
  );

  const accBancolombia = createdAccounts.find((a) => a.name.includes('Bancolombia Ahorros'));
  const accDavivienda = createdAccounts.find((a) => a.name.includes('Davivienda'));
  const accNuBank = createdAccounts.find((a) => a.name.includes('Nu Bank Ahorros'));
  const accEfectivo = createdAccounts.find((a) => a.name.includes('Billetera'));
  const accVisa = createdAccounts.find((a) => a.name.includes('Visa'));
  const accNuCredit = createdAccounts.find((a) => a.name.includes('Tarjeta de Crédito Nu'));

  // 3. Crear Deudas / Me Deben
  console.log('🤝 Creando deudas y cobros pendientes...');
  const debtsData = [
    {
      user: userId,
      name: 'Préstamo Vehicular Banco de Bogotá',
      totalAmount: 18000000,
      remainingAmount: 12400000,
      type: 'debo',
      dueDate: new Date('2027-12-15'),
      color: '#EF4444',
      icon: 'car',
      isActive: true,
      description: 'Financiamiento de automóvil a 36 meses',
    },
    {
      user: userId,
      name: 'Tarjeta de Crédito Visa',
      totalAmount: 3500000,
      remainingAmount: 1850000,
      type: 'debo',
      dueDate: new Date('2026-08-28'),
      color: '#F59E0B',
      icon: 'card',
      isActive: true,
      description: 'Saldo pendiente de compras del mes',
    },
    {
      user: userId,
      name: 'Préstamo a Carlos Gómez',
      totalAmount: 2500000,
      remainingAmount: 900000,
      type: 'me_deben',
      dueDate: new Date('2026-09-30'),
      color: '#10B981',
      icon: 'person',
      isActive: true,
      description: 'Préstamo personal a cuotas mensuales',
    },
    {
      user: userId,
      name: 'Proyecto Freelance TechCorp',
      totalAmount: 3200000,
      remainingAmount: 3200000,
      type: 'me_deben',
      dueDate: new Date('2026-08-31'),
      color: '#3B82F6',
      icon: 'briefcase',
      isActive: true,
      description: 'Entrega final del rediseño UI/UX de plataforma web',
    },
  ];

  const createdDebts = await Debt.insertMany(debtsData);
  const debtCar = createdDebts.find((d) => d.name.includes('Vehicular'));
  const debtCarlos = createdDebts.find((d) => d.name.includes('Carlos'));

  // 4. Crear Recordatorios
  console.log('⏰ Creando recordatorios de pagos...');
  const remindersData = [
    {
      user: userId,
      title: 'Pago Arriendo Apartamento',
      date: new Date('2026-09-05'),
      type: 'periodico',
      amount: 1800000,
      isPaid: false,
      dayOfMonth: 5,
      description: 'Transferencia mensual al arrendador',
      notificationConfig: {
        mode: 'default',
        daysBefore: 2,
        hour: 9,
        startHour: 8,
        endHour: 21,
        initialIntervalMinutes: 120,
        minIntervalMinutes: 60,
      },
    },
    {
      user: userId,
      title: 'Cuota Préstamo Vehicular',
      date: new Date('2026-08-25'),
      type: 'periodico',
      amount: 650000,
      isPaid: false,
      dayOfMonth: 25,
      description: 'Débito automático cuenta de ahorros',
      notificationConfig: {
        mode: 'escalating',
        daysBefore: 1,
        hour: 8,
        startHour: 8,
        endHour: 20,
        initialIntervalMinutes: 120,
        minIntervalMinutes: 30,
      },
    },
    {
      user: userId,
      title: 'Servicios Públicos (EPM + Internet)',
      date: new Date('2026-08-20'),
      type: 'periodico',
      amount: 320000,
      isPaid: false,
      dayOfMonth: 20,
      description: 'Luz, agua, gas y fibra óptica 500MB',
      notificationConfig: {
        mode: 'default',
        daysBefore: 3,
        hour: 10,
        startHour: 8,
        endHour: 21,
        initialIntervalMinutes: 120,
        minIntervalMinutes: 60,
      },
    },
    {
      user: userId,
      title: 'Pago Tarjeta de Crédito Nu',
      date: new Date('2026-08-28'),
      type: 'periodico',
      amount: 250000,
      isPaid: false,
      dayOfMonth: 28,
      description: 'Pago mínimo o total de la tarjeta',
      notificationConfig: {
        mode: 'escalating',
        daysBefore: 1,
        hour: 9,
        startHour: 9,
        endHour: 21,
        initialIntervalMinutes: 60,
        minIntervalMinutes: 30,
      },
    },
    {
      user: userId,
      title: 'Mantenimiento Técnico Carro (Cambio Aceite)',
      date: new Date('2026-08-30'),
      type: 'unico',
      amount: 450000,
      isPaid: false,
      description: 'Revisión de 30,000 KM en concesionario',
      notificationConfig: {
        mode: 'default',
        daysBefore: 2,
        hour: 14,
        startHour: 8,
        endHour: 21,
        initialIntervalMinutes: 120,
        minIntervalMinutes: 60,
      },
    },
  ];

  await Reminder.insertMany(remindersData);

  // 5. Crear Transacciones de Todo el Año 2026 (Enero a Agosto)
  console.log('📊 Generando historial completo de transacciones para 2026...');

  const transactions = [];
  const months = [
    { year: 2026, month: 0, daysInMonth: 31, name: 'Enero' },
    { year: 2026, month: 1, daysInMonth: 28, name: 'Febrero' },
    { year: 2026, month: 2, daysInMonth: 31, name: 'Marzo' },
    { year: 2026, month: 3, daysInMonth: 30, name: 'Abril' },
    { year: 2026, month: 4, daysInMonth: 31, name: 'Mayo' },
    { year: 2026, month: 5, daysInMonth: 30, name: 'Junio' },
    { year: 2026, month: 6, daysInMonth: 31, name: 'Julio' },
    { year: 2026, month: 7, daysInMonth: 17, name: 'Agosto' },
  ];

  for (const m of months) {
    const { year, month } = m;

    // Ingreso Fijo: Salario Nómina (Día 1 de cada mes)
    transactions.push({
      user: userId,
      account: accBancolombia._id,
      title: 'Pago Nómina Empresa Tech',
      amount: 5500000,
      type: 'ingreso',
      date: new Date(year, month, 1, 9, 30),
    });

    // Ingresos Variables / Freelance / Rendimientos
    if (month === 0) {
      transactions.push({
        user: userId,
        account: accNuBank._id,
        title: 'Proyecto Freelance UI Design',
        amount: 1800000,
        type: 'ingreso',
        date: new Date(year, month, 12, 14, 0),
      });
    }
    if (month === 2) {
      transactions.push({
        user: userId,
        account: accNuBank._id,
        title: 'Freelance Desarrollo Web Frontend',
        amount: 2400000,
        type: 'ingreso',
        date: new Date(year, month, 18, 16, 30),
      });
    }
    if (month === 4) {
      transactions.push({
        user: userId,
        account: accBancolombia._id,
        title: 'Bono Desempeño Trimestral',
        amount: 3000000,
        type: 'ingreso',
        date: new Date(year, month, 15, 11, 0),
      });
    }
    if (month === 5) {
      transactions.push({
        user: userId,
        account: accBancolombia._id,
        title: 'Prima de Servicios Junio',
        amount: 2750000,
        type: 'ingreso',
        date: new Date(year, month, 14, 10, 0),
      });
    }
    if (month === 6) {
      transactions.push({
        user: userId,
        account: accDavivienda._id,
        title: 'Consultoría UX App Móvil',
        amount: 1500000,
        type: 'ingreso',
        date: new Date(year, month, 22, 15, 0),
      });
    }

    // Rendimientos Cajita Nu Bank (Todos los meses)
    transactions.push({
      user: userId,
      account: accNuBank._id,
      title: 'Rendimientos Financieros Cuenta Nu',
      amount: Math.floor(85000 + month * 8000),
      type: 'ingreso',
      date: new Date(year, month, 28, 8, 0),
    });

    // Abono Préstamo Carlos Gómez (Cobro pendiente)
    if ([0, 1, 3, 6].includes(month)) {
      transactions.push({
        user: userId,
        account: accNuBank._id,
        debt: debtCarlos._id,
        title: 'Abono de Deuda - Carlos Gómez',
        amount: 400000,
        type: 'abono_deuda',
        date: new Date(year, month, 10, 12, 0),
      });
    }

    // GASTOS FIJOS MENSUALES
    // 1. Arriendo Apartamento (Día 5)
    transactions.push({
      user: userId,
      account: accBancolombia._id,
      title: 'Pago Arriendo Apartamento El Poblado',
      amount: 1800000,
      type: 'egreso',
      date: new Date(year, month, 5, 10, 15),
    });

    // 2. Cuota Préstamo Vehicular (Día 25)
    transactions.push({
      user: userId,
      account: accBancolombia._id,
      debt: debtCar._id,
      title: 'Cuota Mensual Crédito Carro',
      amount: 650000,
      type: 'abono_deuda',
      date: new Date(year, month, Math.min(25, m.daysInMonth), 15, 0),
    });

    // 3. Servicios Públicos (Día 20)
    transactions.push({
      user: userId,
      account: accDavivienda._id,
      title: 'Servicios Públicos EPM + Fibra Óptica',
      amount: Math.floor(290000 + (month % 3) * 15000),
      type: 'egreso',
      date: new Date(year, month, Math.min(20, m.daysInMonth), 11, 30),
    });

    // GASTOS RECURRENTES Y DIVERSOS
    // Mercado y Comestibles
    transactions.push(
      {
        user: userId,
        account: accDavivienda._id,
        title: 'Mercado Principal Carulla',
        amount: Math.floor(380000 + (month % 2) * 40000),
        type: 'egreso',
        date: new Date(year, month, 3, 17, 45),
      },
      {
        user: userId,
        account: accDavivienda._id,
        title: 'Mercado Quincenal Éxito',
        amount: Math.floor(320000 + (month % 3) * 35000),
        type: 'egreso',
        date: new Date(year, month, 16, 18, 20),
      }
    );

    if (m.daysInMonth >= 27) {
      transactions.push({
        user: userId,
        account: accEfectivo._id,
        title: 'Frutas y Verduras Plaza de Mercado',
        amount: 140000,
        type: 'egreso',
        date: new Date(year, month, 27, 10, 30),
      });
    }

    // Salidas a Comer / Restaurantes / Rappi
    transactions.push(
      {
        user: userId,
        account: accVisa._id,
        title: 'Cena Restaurante Crepes & Waffles',
        amount: 135000,
        type: 'egreso',
        date: new Date(year, month, 7, 20, 30),
      },
      {
        user: userId,
        account: accVisa._id,
        title: 'Almuerzo Ejecutivo & Café',
        amount: 95000,
        type: 'egreso',
        date: new Date(year, month, 14, 13, 15),
      },
      {
        user: userId,
        account: accNuCredit._id,
        title: 'Domicilio Rappi / Hamburguesas',
        amount: 68000,
        type: 'egreso',
        date: new Date(year, month, Math.min(21, m.daysInMonth), 21, 0),
      }
    );

    // Transporte & Gasolina
    transactions.push(
      {
        user: userId,
        account: accBancolombia._id,
        title: 'Tanqueda Gasolina Texaco',
        amount: 140000,
        type: 'egreso',
        date: new Date(year, month, 8, 8, 10),
      },
      {
        user: userId,
        account: accBancolombia._id,
        title: 'Tanqueda Gasolina & Peajes',
        amount: 155000,
        type: 'egreso',
        date: new Date(year, month, Math.min(22, m.daysInMonth), 19, 0),
      }
    );

    // Suscripciones y Entretenimiento
    transactions.push(
      {
        user: userId,
        account: accNuCredit._id,
        title: 'Suscripción Netflix 4K + Spotify Premium',
        amount: 68000,
        type: 'egreso',
        date: new Date(year, month, 10, 5, 0),
      },
      {
        user: userId,
        account: accEfectivo._id,
        title: 'Salida Cine & Cinecolombia',
        amount: 72000,
        type: 'egreso',
        date: new Date(year, month, Math.min(18, m.daysInMonth), 17, 30),
      }
    );

    // Gastos ocasionales por mes
    if (month === 1) {
      transactions.push({
        user: userId,
        account: accVisa._id,
        title: 'Compra Ropa Zara & Tennis',
        amount: 580000,
        type: 'egreso',
        date: new Date(year, month, 24, 16, 0),
      });
    }
    if (month === 3) {
      transactions.push({
        user: userId,
        account: accBancolombia._id,
        title: 'Escapada de Fin de Semana (Hotel & Peajes)',
        amount: 1250000,
        type: 'egreso',
        date: new Date(year, month, 17, 12, 0),
      });
    }
    if (month === 5) {
      transactions.push({
        user: userId,
        account: accVisa._id,
        title: 'Auriculares Inalámbricos Sony',
        amount: 890000,
        type: 'egreso',
        date: new Date(year, month, 19, 15, 20),
      });
    }
  }

  await Transaction.insertMany(transactions);
  console.log(`✅ ${transactions.length} transacciones registradas exitosamente.`);

  // 6. Crear Cierres Mensuales (Histórico de Cierre de Mes)
  console.log('📈 Generando cierres mensuales históricos (Enero - Julio 2026)...');
  const closingsData = [
    {
      user: userId,
      period: '2026-01',
      date: new Date('2026-01-31'),
      netWorth: 12450000,
      isAutomatic: true,
      note: 'Cierre de enero con saldo positivo tras ingresos freelance.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 3500000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 2100000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 7200000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 350000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 700000 },
      ],
    },
    {
      user: userId,
      period: '2026-02',
      date: new Date('2026-02-28'),
      netWorth: 13200000,
      isAutomatic: true,
      note: 'Incremento sostenido del patrimonio neto.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 3900000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 2300000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 7600000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 400000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 1000000 },
      ],
    },
    {
      user: userId,
      period: '2026-03',
      date: new Date('2026-03-31'),
      netWorth: 14800000,
      isAutomatic: true,
      note: 'Excelente mes con ingresos adicionales por desarrollo frontend.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 4400000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 2600000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 8400000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 380000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 980000 },
      ],
    },
    {
      user: userId,
      period: '2026-04',
      date: new Date('2026-04-30'),
      netWorth: 15400000,
      isAutomatic: true,
      note: 'Estabilidad en cuentas activas.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 4600000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 2500000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 8700000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 420000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 820000 },
      ],
    },
    {
      user: userId,
      period: '2026-05',
      date: new Date('2026-05-31'),
      netWorth: 17100000,
      isAutomatic: true,
      note: 'Bono trimestral recibido. Fortalecimiento del fondo Nu Bank.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 5200000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 2800000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 9600000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 450000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 950000 },
      ],
    },
    {
      user: userId,
      period: '2026-06',
      date: new Date('2026-06-30'),
      netWorth: 19300000,
      isAutomatic: true,
      note: 'Prima de servicios recibida en junio.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 5900000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 3100000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 11000000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 500000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 1200000 },
      ],
    },
    {
      user: userId,
      period: '2026-07',
      date: new Date('2026-07-31'),
      netWorth: 21100000,
      isAutomatic: true,
      note: 'Patrimonio récord al cierre de julio.',
      accounts: [
        { account: accBancolombia._id, name: accBancolombia.name, color: accBancolombia.color, icon: accBancolombia.icon, isLiability: false, balance: 5400000 },
        { account: accDavivienda._id, name: accDavivienda.name, color: accDavivienda.color, icon: accDavivienda.icon, isLiability: false, balance: 3200000 },
        { account: accNuBank._id, name: accNuBank.name, color: accNuBank.color, icon: accNuBank.icon, isLiability: false, balance: 13500000 },
        { account: accEfectivo._id, name: accEfectivo.name, color: accEfectivo.color, icon: accEfectivo.icon, isLiability: false, balance: 480000 },
        { account: accVisa._id, name: accVisa.name, color: accVisa.color, icon: accVisa.icon, isLiability: true, balance: 1480000 },
      ],
    },
  ];

  await MonthlyClosing.insertMany(closingsData);

  // 7. Crear Historial de Análisis IA de Ejemplo
  console.log('🤖 Generando conversaciones de Análisis IA de ejemplo...');
  const aiChatsData = [
    {
      user: userId,
      title: 'Diagnóstico de Ahorro y Capacidad Financiera 2026',
      messages: [
        {
          role: 'user',
          text: '¿Cómo va mi comportamiento financiero en lo que va del año 2026 y qué recomendaciones me das para optimizar mi patrimonio?',
          createdAt: new Date('2026-08-10T14:20:00'),
        },
        {
          role: 'model',
          text: `¡Hola Steven! He analizado a detalle tus registros financieros de enero a agosto de 2026. Aquí tienes un diagnóstico completo:

### 📈 Aspectos Positivos
1. **Crecimiento de Patrimonio Neto:** Tu patrimonio neto ha crecido de **$12.45M en Enero** a más de **$21.1M en Julio**, un crecimiento extraordinario sostenido por tus ingresos de nómina y proyectos freelance.
2. **Capacidad de Ahorro:** Mantienes una tasa media de ahorro del **34%** de tus ingresos totales.
3. **Control de deudas:** Tu cartera de cobros pendientes (como el préstamo a Carlos) avanza con abonos constantes.

### 💡 Recomendaciones Estratégicas
- **Optimizar Tarjetas de Crédito:** Reducir el saldo revolvente en Visa ($1.85M) para ahorrar en cargos de intereses.
- **Aceleración de Préstamo Vehicular:** Con tu excedente mensual proyectado de $1.8M, te sugiero realizar abonos extraordinarios a capital para recortar el plazo de tu crédito automotriz.`,
          charts: [
            {
              type: 'line',
              title: 'Evolución del Patrimonio Neto 2026 (COP)',
              description: 'Tendencia histórica mensual de activos netos',
              labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
              values: [12.45, 13.2, 14.8, 15.4, 17.1, 19.3, 21.1],
            },
            {
              type: 'pie',
              title: 'Distribución Principal de Gastos',
              description: 'Categorías con mayor impacto en tus egresos',
              labels: ['Arriendo', 'Préstamo Carro', 'Mercado', 'Servicios', 'Otros'],
              values: [14400, 5200, 7100, 2500, 4800],
            },
          ],
          createdAt: new Date('2026-08-10T14:20:15'),
        },
      ],
    },
    {
      user: userId,
      title: 'Estrategia para Liquidación de Deudas',
      messages: [
        {
          role: 'user',
          text: '¿Cuál es el mejor método (avalancha vs bola de nieve) para terminar de pagar mi préstamo vehicular y mis tarjetas de crédito?',
          createdAt: new Date('2026-08-12T16:00:00'),
        },
        {
          role: 'model',
          text: `Te recomiendo aplicar el **Método Avalancha** enfocado en las deudas de mayor tasa de interés:

1. **Prioridad 1 (Tarjetas de Crédito):** Consolida la deuda de la Visa ($1.85M) aplicando los excedentes del próximo pago freelance.
2. **Prioridad 2 (Préstamo Vehicular):** Una vez liberadas las tarjetas, inyecta $500,000 adicionales al pago mensual del crédito de vehículo. Esto reducirá el plazo total en más de 8 meses y te ahorrará dinero en intereses.`,
          charts: [
            {
              type: 'bar',
              title: 'Saldos Pendientes por Deuda (COP)',
              description: 'Comparativa de saldo restante',
              labels: ['Préstamo Carro', 'Tarjeta Visa', 'Tarjeta Nu'],
              values: [12.4, 1.85, 0.62],
            },
          ],
          createdAt: new Date('2026-08-12T16:00:18'),
        },
      ],
    },
  ];

  await AiChat.insertMany(aiChatsData);

  console.log('\n🎉 ¡Población de datos completada con éxito!');
  console.log('----------------------------------------------------');
  console.log(`👤 Usuario: ${email}`);
  console.log(`🔑 Contraseña: ${plainPassword}`);
  console.log(`🏦 Cuentas creadas: ${createdAccounts.length}`);
  console.log(`💳 Deudas/Cobros creados: ${createdDebts.length}`);
  console.log(`⏰ Recordatorios creados: ${remindersData.length}`);
  console.log(`📊 Transacciones generadas: ${transactions.length}`);
  console.log(`📈 Cierres mensuales: ${closingsData.length}`);
  console.log(`🤖 Chats de IA: ${aiChatsData.length}`);
  console.log('----------------------------------------------------');

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error ejecutando seed:', err);
  process.exit(1);
});
