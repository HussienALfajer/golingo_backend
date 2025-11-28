/**
 * Login Attempt Schema
 * MongoDB schema for tracking failed login attempts
 * Used to implement account lockout after too many failed attempts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LoginAttemptDocument = LoginAttempt & Document;

@Schema({ timestamps: true, collection: 'login_attempts' })
export class LoginAttempt {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ required: true, default: false })
  successful: boolean;

  @Prop({ type: String })
  userAgent?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);

// Index for efficient lookup of recent attempts
LoginAttemptSchema.index({ email: 1, createdAt: -1 });
LoginAttemptSchema.index({ ipAddress: 1, createdAt: -1 });

// TTL index to automatically delete old attempts (keep for 24 hours)
LoginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
