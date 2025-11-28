/**
 * Register DTO
 * Data transfer object for user registration
 */

import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'learner@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description:
      'User password (min 8 characters, must contain uppercase, lowercase, and number)',
    example: 'Password123',
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
      requireSpecialChar: false, // Optional for children/accessibility
    },
    {
      message:
        'Password must be 8-128 characters with at least one uppercase letter, one lowercase letter, and one number',
    },
  )
  password: string;

  @ApiProperty({
    description: 'Display name for the user',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(2, { message: 'Display name must be at least 2 characters long' })
  displayName: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    default: UserRole.LEARNER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'User age (for learners)',
    example: 10,
    minimum: 0,
    maximum: 150,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(150)
  age?: number;
}
