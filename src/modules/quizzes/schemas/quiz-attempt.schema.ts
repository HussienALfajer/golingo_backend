/**
 * Quiz Attempt Schema
 * MongoDB schema for tracking quiz attempts by learners
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizAttemptDocument = QuizAttempt & Document;

/**
 * Answer interface for quiz attempt answers
 */
export interface QuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect?: boolean;
}

@Schema({ timestamps: true, collection: 'quiz_attempts' })
export class QuizAttempt {
  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true })
  quizId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0, max: 100 })
  score: number;

  @Prop({ required: true, type: Boolean })
  passed: boolean;

  @Prop({
    type: [
      {
        questionId: { type: String, required: true },
        selectedOptionIds: { type: [String], required: true },
        isCorrect: { type: Boolean, required: false },
      },
    ],
    required: true,
  })
  answers: QuizAnswer[];

  createdAt?: Date;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);

// Indexes
QuizAttemptSchema.index({ quizId: 1, userId: 1 });
QuizAttemptSchema.index({ userId: 1, createdAt: -1 });
QuizAttemptSchema.index({ quizId: 1, userId: 1, score: -1 });
