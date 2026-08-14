import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReminderType = 'unico' | 'periodico';

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

ReminderSchema.index({ user: 1, date: 1 });

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
