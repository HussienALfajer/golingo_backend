/**
 * Add Friend DTO
 */

import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddFriendDto {
  @ApiProperty({ description: 'Friend User ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  friendId: string;
}

