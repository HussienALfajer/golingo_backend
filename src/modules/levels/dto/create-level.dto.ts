/**
 * Create Level DTO
 * Data transfer object for creating a new level
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLevelDto {
  @ApiProperty({ description: 'Level code (unique identifier)', example: 'L1' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Level title', example: 'Level 1: Beginner' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Level description',
    example: 'Introduction to sign language basics',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Order/position of the level',
    example: 1,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Order must be a number' })
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    description: 'Whether the level is active',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Backblaze folder path for this level',
    example: 'levels/level-1',
  })
  @IsString()
  backblazeFolderPath: string;
}
