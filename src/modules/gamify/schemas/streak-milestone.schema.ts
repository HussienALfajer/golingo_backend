/**
 * Streak Milestone Schema
 * MongoDB schema for defining streak milestones and their rewards
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StreakMilestoneDocument = StreakMilestone & Document;

export interface MilestoneReward {
  gems?: number;
  xpBoostMultiplier?: number;
  xpBoostDurationMinutes?: number;
  streakFreeze?: boolean;
  specialBadge?: string;
}

@Schema({ timestamps: true, collection: 'streak_milestones' })
export class StreakMilestone {
  @Prop({ required: true, unique: true })
  day: number; // e.g., 3, 7, 14, 30, 60, 90, 180, 365

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String })
  celebrationMessage?: string;

  @Prop({ type: String })
  icon?: string;

  @Prop({
    type: {
      gems: { type: Number, default: 0 },
      xpBoostMultiplier: { type: Number },
      xpBoostDurationMinutes: { type: Number },
      streakFreeze: { type: Boolean, default: false },
      specialBadge: { type: String },
    },
    required: true,
  })
  reward: MilestoneReward;

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StreakMilestoneSchema =
  SchemaFactory.createForClass(StreakMilestone);

// Index for efficient lookup
StreakMilestoneSchema.index({ day: 1 }, { unique: true });
StreakMilestoneSchema.index({ isActive: 1, day: 1 });
