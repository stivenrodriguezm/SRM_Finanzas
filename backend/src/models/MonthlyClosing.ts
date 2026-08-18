import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAccountSnapshot {
  account: Types.ObjectId;
  name: string;
  color: string;
  icon: string;
  isLiability: boolean;
  balance: number;
}

export interface IMonthlyClosing extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** 'YYYY-MM', único por usuario — un cierre por mes. */
  period: string;
  /** Fecha real que representa el cierre (el día elegido de ese período, o el día de captura manual). */
  date: Date;
  /** Siempre derivado de `accounts` en el servidor — nunca se edita directo. */
  netWorth: number;
  accounts: IAccountSnapshot[];
  isAutomatic: boolean;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSnapshotSchema = new Schema<IAccountSnapshot>(
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

const MonthlyClosingSchema = new Schema<IMonthlyClosing>(
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

MonthlyClosingSchema.index({ user: 1, period: 1 }, { unique: true });

export default mongoose.model<IMonthlyClosing>('MonthlyClosing', MonthlyClosingSchema);
