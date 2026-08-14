import mongoose, { Schema, Document, Types } from 'mongoose';

export type TransactionType = 'ingreso' | 'egreso' | 'abono_deuda';

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  account: Types.ObjectId;
  reminder?: Types.ObjectId;
  debt?: Types.ObjectId;
  title: string;
  amount: number;
  type: TransactionType;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    account: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
    reminder: { type: Schema.Types.ObjectId, ref: 'Reminder' },
    debt: { type: Schema.Types.ObjectId, ref: 'Debt' },
    title: { type: String, required: [true, 'Por favor añade un título'] },
    amount: { type: Number, required: [true, 'Por favor añade un monto'] },
    type: { type: String, required: true, enum: ['ingreso', 'egreso', 'abono_deuda'] },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TransactionSchema.index({ user: 1, date: -1 });
TransactionSchema.index({ user: 1, debt: 1 });
TransactionSchema.index({ user: 1, reminder: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
