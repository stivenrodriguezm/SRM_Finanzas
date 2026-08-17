import mongoose, { Schema, Document, Types } from 'mongoose';
import { AiChart } from '../utils/geminiClient';

export type AiChatRole = 'user' | 'model';

export interface IAiChatMessage {
  role: AiChatRole;
  text: string;
  charts?: AiChart[];
  createdAt: Date;
}

export interface IAiChat extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  messages: IAiChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const AiChartSchema = new Schema<AiChart>(
  {
    type: { type: String, enum: ['bar', 'pie', 'line'], required: true },
    title: { type: String, required: true },
    description: { type: String },
    labels: { type: [String], required: true },
    values: { type: [Number], required: true },
  },
  { _id: false }
);

const AiChatMessageSchema = new Schema<IAiChatMessage>(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true },
    charts: { type: [AiChartSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiChatSchema = new Schema<IAiChat>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    messages: { type: [AiChatMessageSchema], default: [] },
  },
  { timestamps: true }
);

AiChatSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model<IAiChat>('AiChat', AiChatSchema);
