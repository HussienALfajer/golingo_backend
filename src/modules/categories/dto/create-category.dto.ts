/**
 * Create Category DTO
 * Data transfer object for creating a new category
 */

import {
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'ID of the parent level',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  levelId: string;

  @ApiProperty({
    description: 'Category code (unique within level)',
    example: 'food',
  })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Category title', example: 'Food' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Learn sign language for food items',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Order/position of the category within the level',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    description: 'Whether the category is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Backblaze folder path for this category (auto-generated if not provided)',
    example: 'levels/level-1/categories/food',
  })
  @IsOptional()
  @IsString()
  backblazeFolderPath?: string;
}
