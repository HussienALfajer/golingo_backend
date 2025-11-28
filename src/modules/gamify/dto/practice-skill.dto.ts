/**
 * Practice Skill DTO
 */

import { IsMongoId, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PracticeSkillDto {
  @ApiProperty({ description: 'Skill (Category) ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  skillId: string;

  @ApiProperty({ description: 'XP gained from practice', example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  xpGained: number;

  @ApiProperty({ description: 'Number of mistakes', example: 2, minimum: 0 })
  @IsNumber()
  @Min(0)
  mistakes: number;
}

