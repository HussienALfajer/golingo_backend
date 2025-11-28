/**
 * Apply Session DTO
 * Data transfer object for applying a learning/quiz session to gamification stats
 */

import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsMongoId,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplySessionDto {
  @ApiProperty({ description: 'Number of correct answers', example: 8 })
  @IsNumber()
  @Min(0)
  correct: number;

  @ApiProperty({ description: 'Total number of questions', example: 10 })
  @IsNumber()
  @Min(1)
  total: number;

  @ApiProperty({
    description: 'Whether the quiz/session was passed',
    example: true,
  })
  @IsBoolean()
  passed: boolean;

  @ApiPropertyOptional({
    description: 'Category ID (optional)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Quiz ID (optional)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  quizId?: string;
}
