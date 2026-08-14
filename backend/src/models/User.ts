import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserPreferences {
  theme: 'light' | 'dark' | 'system';
  hideAmounts: boolean;
  accountOrder: string[];
  selectedAccounts: string[];
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  preferences: IUserPreferences;
  resetPasswordCodeHash?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
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
    },
    resetPasswordCodeHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
