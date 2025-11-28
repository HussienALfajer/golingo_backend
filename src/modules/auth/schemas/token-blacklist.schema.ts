/**
 * Token Blacklist Schema
 * MongoDB schema for storing invalidated JWT tokens
 * Used to implement proper logout and token revocation
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TokenBlacklistDocument = TokenBlacklist & Document;

@Schema({ timestamps: true, collection: 'token_blacklist' })
export class TokenBlacklist {
  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: String, enum: ['access', 'refresh'], required: true })
  tokenType: 'access' | 'refresh';

  createdAt?: Date;
  updatedAt?: Date;
}

export const TokenBlacklistSchema =
  SchemaFactory.createForClass(TokenBlacklist);

// TTL index to automatically delete expired tokens (cleanup)
TokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookup
TokenBlacklistSchema.index({ token: 1, tokenType: 1 });
