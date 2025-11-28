/**
 * Lesson Schema
 * Represents a single word (gloss) with multiple WLASL videos
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonDocument = Lesson & Document;

@Schema({ _id: false })
export class LessonVideo {
  @Prop({ required: true })
  videoId: string; // WLASL video_id

  @Prop({ required: true })
  b2Key: string; // e.g. "asl/L1/family/mother/12345.mp4"

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Boolean, default: true })
  isForLesson: boolean; // used in lesson view

  @Prop({ type: Boolean, default: false })
  isForQuiz: boolean; // used in final quiz
}

@Schema({ timestamps: true, collection: 'lessons' })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: 'Level', required: true })
  levelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  gloss: string; // raw WLASL gloss, e.g. "mother"

  @Prop({ required: true, trim: true })
  title: string; // display name (can initially equal gloss)

  @Prop({ type: String, trim: true })
  description?: string;

  /**
   * Base Backblaze folder for this lesson, e.g. "asl/L1/family/mother"
   */
  @Prop({ required: true })
  b2FolderKey: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [LessonVideo], default: [] })
  videos: LessonVideo[];
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);

// Indexes
LessonSchema.index({ categoryId: 1, order: 1 });
LessonSchema.index({ levelId: 1, categoryId: 1 });
LessonSchema.index({ categoryId: 1, gloss: 1 }, { unique: true });
