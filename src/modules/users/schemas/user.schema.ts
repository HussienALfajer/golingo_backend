/**
 * User Schema
 * MongoDB schema for user entities (both ADMIN and LEARNER roles)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../../../common/enums/user-role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.LEARNER })
  role: UserRole;

  @Prop({ type: Number, min: 0, max: 150 })
  age?: number;

  @Prop({ type: String })
  avatar?: string;

  @Prop({ type: Date })
  lastActiveAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

// Transform to remove sensitive fields
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};
