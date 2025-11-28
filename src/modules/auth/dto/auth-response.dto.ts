/**
 * Auth Response DTO
 * Data transfer object for authentication responses
 */

import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/user-role.enum';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'User email' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Display name' })
  @Expose()
  displayName: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  @Expose()
  role: UserRole;

  @ApiPropertyOptional({ description: 'User age' })
  @Expose()
  age?: number;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @Expose()
  avatar?: string;

  @Exclude()
  passwordHash?: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Access token (JWT)' })
  @Expose()
  accessToken: string;

  @ApiProperty({ description: 'Refresh token (JWT)' })
  @Expose()
  refreshToken: string;

  @ApiProperty({ description: 'User information', type: UserResponseDto })
  @Expose()
  user: UserResponseDto;
}
