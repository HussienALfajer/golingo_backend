/**
 * Change Password DTO
 * Data transfer object for changing password for authenticated user
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    description:
      'New password (min 8 characters, must contain uppercase, lowercase, and number)',
    example: 'NewPassword123',
    minLength: 8,
  })
  @IsString()
  @IsStrongPassword(
    {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: false,
    },
    {
      message:
        'Password must be 8-128 characters with at least one uppercase letter, one lowercase letter, and one number',
    },
  )
  newPassword: string;
}
