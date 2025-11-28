/**
 * Purchase DTO
 * Data transfer object for purchasing shop items
 */

import { IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseDto {
  @ApiProperty({
    description: 'Shop item ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  shopItemId: string;
}
