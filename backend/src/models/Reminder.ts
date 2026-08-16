import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReminderType = 'unico' | 'periodico';

/**
 * 'default': un único aviso N días antes (comportamiento histórico).
 * 'escalating': cascada de avisos el día activo (vencimiento/aplazamiento), cada vez más
 *   seguidos — ver mobile-app/src/utils/reminderNotificationSchedule.ts para el cálculo real.
 * 'off': sin notificaciones para este recordatorio.
 */
export type ReminderNotificationMode = 'default' | 'escalating' | 'off';

export interface IReminderNotificationConfig {
  mode: ReminderNotificationMode;
  daysBefore: number;
  hour: number;
  startHour: number;
  endHour: number;
  initialIntervalMinutes: number;
  minIntervalMinutes: number;
}

export interface IReminder extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  date: Date;
  type: ReminderType;
  amount?: number;
  isPaid: boolean;
  paymentLink?: string;
  description?: string;
  dayOfMonth?: number;
  notificationConfig: IReminderNotificationConfig;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderNotificationConfigSchema = new Schema<IReminderNotificationConfig>(
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

const ReminderSchema = new Schema<IReminder>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: [true, 'Por favor añade un título'] },
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

ReminderSchema.index({ user: 1, date: 1 });

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
