/**
 * Question Schema (Embedded Document)
 * Schema for quiz questions embedded within Quiz documents
 */

import { Prop, Schema } from '@nestjs/mongoose';
import { QuestionType } from '../../../common/enums/question-type.enum';

@Schema({ _id: false })
export class Question {
  @Prop({ required: true, type: String })
  questionId: string;

  @Prop({ required: true, type: String })
  text: string;

  @Prop({
    required: true,
    enum: QuestionType,
    default: QuestionType.SINGLE_CHOICE,
  })
  type: QuestionType;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    required: true,
  })
  options: Array<{ id: string; text: string }>;

  @Prop({
    type: [String],
    required: true,
  })
  correctOptionIds: string[];

  @Prop({ type: String })
  imageUrl?: string;

  @Prop({ type: String })
  videoUrl?: string;

  @Prop({ type: String })
  explanation?: string;
}
