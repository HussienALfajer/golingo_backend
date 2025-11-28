/**
 * Achievement Share Schema
 * MongoDB schema for social achievement posts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AchievementShareDocument = AchievementShare & Document;

@Schema({ timestamps: true, collection: 'achievement_shares' })
export class AchievementShare {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'UserAchievement', required: true })
  userAchievementId: Types.ObjectId;

  @Prop({ type: String, trim: true })
  message?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  likeCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ required: true, type: Boolean, default: true })
  isPublic: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AchievementShareSchema = SchemaFactory.createForClass(AchievementShare);

// Indexes
AchievementShareSchema.index({ userId: 1, createdAt: -1 });
AchievementShareSchema.index({ userAchievementId: 1 });
AchievementShareSchema.index({ isPublic: 1, createdAt: -1 });

