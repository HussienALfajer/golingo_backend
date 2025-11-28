/**
 * Category Progress Schema
 * MongoDB schema for tracking learner progress through categories
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryProgressDocument = CategoryProgress & Document;

@Schema({ timestamps: true, collection: 'category_progress' })
export class CategoryProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Date })
  unlockedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Number, min: 0, max: 100 })
  finalQuizBestScore?: number;

  @Prop({ required: true, type: Boolean, default: false })
  finalQuizPassed: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategoryProgressSchema =
  SchemaFactory.createForClass(CategoryProgress);

// Indexes - unique compound index to ensure one progress record per user-category
CategoryProgressSchema.index({ userId: 1, categoryId: 1 }, { unique: true });
CategoryProgressSchema.index({ userId: 1, completedAt: 1 });
