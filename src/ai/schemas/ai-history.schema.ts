// src/ai-history/schemas/ai-history.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AIHistory extends Document {
  @Prop({ required: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, ref: 'Doc' })
  documentId: Types.ObjectId;

  @Prop({ required: true })
  action: string; // e.g., "Improve writing", "Make shorter"

  @Prop({ required: true })
  original: string;

  @Prop({ required: true })
  improved: string;

  @Prop({ required: true })
  modal: string;

  @Prop({ enum: ['pending', 'accepted', 'rejected', 'error'], default: 'pending' })
  status: string;
}

export const AIHistorySchema = SchemaFactory.createForClass(AIHistory);