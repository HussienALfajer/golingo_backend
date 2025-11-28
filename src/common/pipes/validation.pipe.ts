/**
 * Validation Pipe
 * Global validation pipe with custom configuration
 */

import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

export const ValidationPipe = new NestValidationPipe({
  whitelist: true, // Strip properties that don't have decorators
  forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
  transform: true, // Automatically transform payloads to DTO instances
  transformOptions: {
    enableImplicitConversion: true, // Enable implicit type conversion
  },
});
