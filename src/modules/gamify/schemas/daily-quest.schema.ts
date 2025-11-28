/**
 * Daily Quest Schema
 * MongoDB schema for daily quests/challenges
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyQuestDocument = DailyQuest & Document;

export enum QuestType {
  EARN_XP = 'earn_xp',
  COMPLETE_LESSONS = 'complete_lessons',
  PRACTICE_SKILL = 'practice_skill',
  MAINTAIN_STREAK = 'maintain_streak',
  PERFECT_PRACTICE = 'perfect_practice',
  COMPLETE_QUIZ = 'complete_quiz',
  FRIEND_CHALLENGE = 'friend_challenge',
}

export enum QuestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'daily_quests' })
export class DailyQuest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: QuestType })
  questType: QuestType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String })
  iconUrl?: string;

  @Prop({ required: true, type: Number, min: 1 })
  target: number; // Target value (e.g., 50 XP, 2 lessons)

  @Prop({ type: Number, default: 0, min: 0 })
  progress: number; // Current progress

  @Prop({ required: true, type: Number, min: 0 })
  reward: number; // Gem reward

  @Prop({ required: true, enum: QuestStatus, default: QuestStatus.PENDING })
  status: QuestStatus;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  claimedAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Additional quest data

  createdAt?: Date;
  updatedAt?: Date;
}

export const DailyQuestSchema = SchemaFactory.createForClass(DailyQuest);

// Indexes
DailyQuestSchema.index({ userId: 1, status: 1, expiresAt: 1 });
DailyQuestSchema.index({ userId: 1, createdAt: -1 });
DailyQuestSchema.index({ expiresAt: 1, status: 1 });

