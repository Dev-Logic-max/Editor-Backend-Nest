import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Request extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId; // Creator

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiver: Types.ObjectId; // Invite recipient

  @Prop({ type: Types.ObjectId, ref: 'Doc', required: true })
  document: Types.ObjectId;

  @Prop({ enum: ['pending', 'accepted', 'rejected'], default: 'pending' })
  status: string;

  @Prop({ required: true })
  message?: string; // Optional invite message
}

export const RequestSchema = SchemaFactory.createForClass(Request);
