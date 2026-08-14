import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAccount extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  balance: number;
  color: string;
  icon: string;
  isLiability: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: [true, 'Por favor añade un nombre para la cuenta'] },
    balance: { type: Number, required: true, default: 0 },
    color: { type: String, default: '#000000' },
    icon: { type: String, default: 'wallet' },
    isLiability: { type: Boolean, default: false },
    description: { type: String },
  },
  { timestamps: true }
);

AccountSchema.index({ user: 1 });

export default mongoose.model<IAccount>('Account', AccountSchema);
