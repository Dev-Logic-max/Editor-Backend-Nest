import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UserRole } from '../../common/enums/roles.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  firstName: string;

  @Prop()
  lastName?: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  connections: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Document' }], default: [] })
  documents: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  resetToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
