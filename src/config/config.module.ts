/**
 * Configuration Module
 * Sets up NestJS ConfigModule with environment variable validation
 */

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configValidationSchema, configuration } from './configuration';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // Make config available throughout the app
      load: [configuration],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
