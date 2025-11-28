/**
 * Quiz Schema
 * MongoDB schema for quizzes (category final quizzes only)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { QuizType } from '../../../common/enums/quiz-type.enum';
import { Question } from './question.schema';

export type QuizDocument = Quiz & Document;

@Schema({ timestamps: true, collection: 'quizzes' })
export class Quiz {
  @Prop({ required: true, enum: QuizType, default: QuizType.CATEGORY_FINAL })
  type: QuizType;

  @Prop({ type: String, enum: ['MANUAL', 'WLASL'], default: 'MANUAL' })
  source?: string; // "WLASL" for quizzes generated from WLASL lessons

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, type: Number, default: 60, min: 0, max: 100 })
  passingScore: number;

  @Prop({ type: [Question], required: true, default: [] })
  questions: Question[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);

// Indexes
QuizSchema.index({ type: 1, categoryId: 1 });

// Validation: ensure categoryId is set
QuizSchema.pre('validate', function (next) {
  if (!this.categoryId) {
    next(new Error('categoryId is required for quiz'));
  } else {
    next();
  }
});
