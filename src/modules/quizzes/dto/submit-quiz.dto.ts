/**
 * Submit Quiz DTO
 * Data transfer object for submitting quiz answers
 */

import { IsString, IsArray, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerDto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: 'Selected option IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds: string[];
}

export class SubmitQuizDto {
  @ApiProperty({ description: 'Quiz ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  quizId: string;

  @ApiProperty({ description: 'User answers', type: [QuizAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
