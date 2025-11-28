/**
 * Skill Progress Schema
 * MongoDB schema for skill mastery (crown levels) per category
 * This replaces/enhances category_progress with Duolingo-style mastery
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SkillProgressDocument = SkillProgress & Document;

export enum CrownLevel {
  LEVEL_0 = 0, // Not started
  LEVEL_1 = 1, // Beginner
  LEVEL_2 = 2, // Intermediate
  LEVEL_3 = 3, // Advanced
  LEVEL_4 = 4, // Expert
  LEVEL_5 = 5, // Master
}

@Schema({ timestamps: true, collection: 'skill_progress' })
export class SkillProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  skillId: Types.ObjectId; // Category ID (skill = category in our system)

  @Prop({ required: true, enum: CrownLevel, default: CrownLevel.LEVEL_0 })
  crownLevel: CrownLevel;

  @Prop({ type: Number, default: 0, min: 0 })
  currentXP: number; // XP within current crown level

  @Prop({ type: Number, default: 60, min: 1 })
  xpToNextCrown: number; // XP needed to reach next crown level

  @Prop({ type: Number, default: 0, min: 0 })
  totalXP: number; // Total XP earned in this skill

  @Prop({ type: Number, default: 0, min: 0 })
  mistakeCount: number; // Mistakes made in this skill

  @Prop({ type: Number, default: 0, min: 0 })
  practiceCount: number; // Number of practice sessions

  @Prop({ type: Date })
  lastPracticedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isLegendary: boolean; // Has completed legendary challenge

  @Prop({ type: Number, default: 0, min: 0 })
  legendaryAttempts: number; // Attempts at legendary level

  @Prop({ type: Date })
  legendaryCompletedAt?: Date;

  @Prop({ type: Date })
  firstCrownAt?: Date; // When first crown was achieved

  @Prop({ type: Date })
  lastCrownAt?: Date; // When last crown was achieved

  createdAt?: Date;
  updatedAt?: Date;
}

export const SkillProgressSchema = SchemaFactory.createForClass(SkillProgress);

// Indexes
SkillProgressSchema.index({ userId: 1, skillId: 1 }, { unique: true });
SkillProgressSchema.index({ userId: 1, crownLevel: -1 });
SkillProgressSchema.index({ userId: 1, totalXP: -1 });
SkillProgressSchema.index({ skillId: 1, crownLevel: -1 });

