/**
 * Create Video DTO
 * Data transfer object for creating a new video
 */

import {
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VideoAttachmentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsString()
  key: string;
}

export class CreateVideoDto {
  @ApiProperty({
    description: 'ID of the parent category',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  categoryId: string;

  @ApiProperty({
    description: 'Video title',
    example: 'Introduction to Food Signs',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Video description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Order/position of the video within the category',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    description:
      'Video URL from Backblaze (optional if uploading via upload endpoint)',
    example: 'https://f005.backblazeb2.com/file/...',
  })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Thumbnail image URL from Backblaze' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional attachments (PDFs, images, etc.)',
    type: [VideoAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  attachments?: VideoAttachmentDto[];

  @ApiPropertyOptional({
    description: 'Whether the video is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
