/**
 * Achievement Schema
 * MongoDB schema for achievements/badges that learners can unlock
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AchievementCriteriaType } from '../../../common/enums/achievement-criteria-type.enum';

export type AchievementDocument = Achievement & Document;

@Schema({ timestamps: true, collection: 'achievements' })
export class Achievement {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String })
  iconUrl?: string;

  @Prop({ required: true, enum: AchievementCriteriaType })
  criteriaType: AchievementCriteriaType;

  @Prop({ type: Object, default: {} })
  criteriaConfig: Record<string, any>;

  @Prop({ type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' })
  tier?: string; // Achievement tier (Bronze/Silver/Gold)

  @Prop({ type: Number, default: 0, min: 0 })
  xpReward: number; // XP reward for unlocking

  @Prop({ type: Number, default: 0, min: 0 })
  gemReward: number; // Gem reward for unlocking

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);

// Indexes
AchievementSchema.index({ code: 1 });
AchievementSchema.index({ criteriaType: 1, isActive: 1 });
