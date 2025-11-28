/**
 * Create Quiz DTO
 * Data transfer object for creating a new quiz
 */

import {
  IsEnum,
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizType } from '../../../common/enums/quiz-type.enum';
import { QuestionType } from '../../../common/enums/question-type.enum';

export class QuizOptionDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  text: string;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ enum: QuestionType, default: QuestionType.SINGLE_CHOICE })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ type: [QuizOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];

  @ApiProperty({ type: [String], description: 'IDs of correct options' })
  @IsArray()
  @IsString({ each: true })
  correctOptionIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CreateQuizDto {
  @ApiProperty({
    enum: QuizType,
    description: 'Type of quiz (always CATEGORY_FINAL)',
    default: QuizType.CATEGORY_FINAL,
  })
  @IsEnum(QuizType)
  @IsOptional()
  type?: QuizType;

  @ApiProperty({ description: 'Category ID (required)' })
  @IsMongoId()
  categoryId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Passing score (0-100)',
    default: 60,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore: number;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
