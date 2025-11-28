/**
 * Claim Quest DTO
 */

import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimQuestDto {
  @ApiProperty({ description: 'Quest ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  questId: string;
}

