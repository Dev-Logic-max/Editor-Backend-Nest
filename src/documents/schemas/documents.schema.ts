import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { DocumentStatus } from 'src/common/enums/docs.enum';

export interface MediaItem {
  filename: string;
  originalName: String,
  url: string;
  type: 'image' | 'video' | 'document';
  size: number;
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class Doc extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Object, default: {} })
  content?: any; // Y.js/Tiptap content

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: Types.ObjectId; 

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  collaborators: Types.ObjectId[];

  @Prop({ type: String, enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Prop({
    type: [
      {
        filename: String,
        originalName: String,
        url: String,
        type: { type: String, enum: ['image', 'video', 'document'] },
        size: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  media: MediaItem[];
}

export const DocumentSchema = SchemaFactory.createForClass(Doc);
