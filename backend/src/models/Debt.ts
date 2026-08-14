import mongoose, { Schema, Document, Types } from 'mongoose';

export type DebtType = 'debo' | 'me_deben';

export interface IDebt extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  type: DebtType;
  dueDate?: Date;
  color: string;
  icon: string;
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DebtSchema = new Schema<IDebt>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: [true, 'Por favor añade un nombre para la deuda'] },
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

DebtSchema.index({ user: 1 });

export default mongoose.model<IDebt>('Debt', DebtSchema);
