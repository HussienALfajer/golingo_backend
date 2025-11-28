/**
 * Password Validator
 * Custom class-validator decorator for password complexity requirements
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export interface PasswordRequirements {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false, // Optional for accessibility (children may have difficulty)
};

export function IsStrongPassword(
  requirements: PasswordRequirements = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [requirements],
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;

          const reqs = { ...DEFAULT_REQUIREMENTS, ...args.constraints[0] };
          const errors: string[] = [];

          if (reqs.minLength && value.length < reqs.minLength) {
            errors.push(`at least ${reqs.minLength} characters`);
          }

          if (reqs.maxLength && value.length > reqs.maxLength) {
            errors.push(`no more than ${reqs.maxLength} characters`);
          }

          if (reqs.requireUppercase && !/[A-Z]/.test(value)) {
            errors.push('at least one uppercase letter');
          }

          if (reqs.requireLowercase && !/[a-z]/.test(value)) {
            errors.push('at least one lowercase letter');
          }

          if (reqs.requireNumber && !/\d/.test(value)) {
            errors.push('at least one number');
          }

          if (
            reqs.requireSpecialChar &&
            !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)
          ) {
            errors.push('at least one special character');
          }

          // Store errors for message
          (args.object as any).__passwordErrors = errors;

          return errors.length === 0;
        },
        defaultMessage(args: ValidationArguments) {
          const errors = (args.object as any).__passwordErrors || [];
          if (errors.length === 0) {
            return 'Password does not meet requirements';
          }
          return `Password must contain ${errors.join(', ')}`;
        },
      },
    });
  };
}
