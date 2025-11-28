/**
 * Lesson Progress Schema
 * MongoDB schema for tracking learner progress through lessons
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonProgressDocument = LessonProgress & Document;

@Schema({ timestamps: true, collection: 'lesson_progress' })
export class LessonProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true })
  lessonId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  watchedVideos: string[]; // Array of watched video IDs from the lesson

  @Prop({ required: true, type: Boolean, default: false })
  allVideosWatched: boolean;

  @Prop({ type: Date, required: true, default: Date.now })
  unlockedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LessonProgressSchema = SchemaFactory.createForClass(LessonProgress);

// Indexes
LessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
LessonProgressSchema.index({ userId: 1, allVideosWatched: 1 });
LessonProgressSchema.index({ unlockedAt: 1 });
