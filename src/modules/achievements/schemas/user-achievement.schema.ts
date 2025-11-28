/**
 * User Achievement Schema
 * MongoDB schema for tracking which achievements users have unlocked
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserAchievementDocument = UserAchievement & Document;

@Schema({ timestamps: true, collection: 'user_achievements' })
export class UserAchievement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Achievement', required: true })
  achievementId: Types.ObjectId;

  @Prop({ type: Date })
  unlockedAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserAchievementSchema =
  SchemaFactory.createForClass(UserAchievement);

// Indexes - unique compound index to prevent duplicate achievements per user
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, unlockedAt: -1 });
