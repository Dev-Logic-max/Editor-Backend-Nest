import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { DocumentStatus } from '../../common/enums/docs.enum';

@Schema({ timestamps: true })
export class Doc extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Object, default: {} })
  content?: any; // Y.js/Tiptap content

  // @Prop({ type: Buffer, default: null }) // Change from Object to Buffer
  // content: Buffer; // Binary Y.Doc update

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: Types.ObjectId; // User who created the document

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  collaborators: Types.ObjectId[]; // Users who can edit

  @Prop({ type: String, enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  // @Prop({ type: Object, default: {} })
  // content: any; // JSON for Tiptap content
}

export const DocumentSchema = SchemaFactory.createForClass(Doc);
