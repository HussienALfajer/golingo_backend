/**
 * Level Progress Schema
 * MongoDB schema for tracking learner progress through levels
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LevelProgressDocument = LevelProgress & Document;

@Schema({ timestamps: true, collection: 'level_progress' })
export class LevelProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Level', required: true })
  levelId: Types.ObjectId;

  @Prop({ type: Date })
  unlockedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ required: true, type: Boolean, default: false })
  allCategoriesCompleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LevelProgressSchema = SchemaFactory.createForClass(LevelProgress);

// Indexes - unique compound index to ensure one progress record per user-level
LevelProgressSchema.index({ userId: 1, levelId: 1 }, { unique: true });
LevelProgressSchema.index({ userId: 1, completedAt: 1 });
