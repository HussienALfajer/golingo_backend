/**
 * Configuration schema and validation
 * This file exports a configuration object that maps environment variables
 * to typed configuration values for use throughout the application.
 */

import * as Joi from 'joi';

/**
 * Configuration interface defining all application settings
 */
export interface AppConfig {
  app: {
    name: string;
    env: string;
    port: number;
    apiPrefix: string;
  };
  database: {
    uri: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  storage: {
    provider: string;
    bucket: string;
    baseUrl: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    s3Endpoint?: string;
  };
  firebase: {
    serviceAccount?: string;
  };
}

/**
 * Joi validation schema for environment variables
 * Validates all required environment variables at application startup
 */
export const configValidationSchema = Joi.object({
  // Application Configuration
  APP_NAME: Joi.string().default('sign-language-platform'),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  // Database Configuration
  MONGODB_URI: Joi.string().required(),

  // Authentication Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('6d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('604800'),

  // CORS Configuration
  AR_ALLOWED_ORIGINS: Joi.string().required(),

  // Storage Configuration
  STORAGE_PROVIDER: Joi.string().default('backblaze'),
  STORAGE_BUCKET: Joi.string().required(),
  STORAGE_BASE_URL: Joi.string().required(),
  AWS_ACCESS_KEY_IDs: Joi.string().required(),
  AWS_SECRET_ACCESS_KEYs: Joi.string().required(),
  AWS_REGIONs: Joi.string().required(),
  AWS_S3_ENDPOINT: Joi.string().required(),

  // Firebase Configuration (optional)
  FIREBASE_SERVICE_ACCOUNT: Joi.string().allow('').optional(),
});

/**
 * Factory function to build configuration object from environment variables
 */
export const configuration = (): AppConfig => {
  const allowedOrigins = process.env.AR_ALLOWED_ORIGINS
    ? process.env.AR_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [];

  return {
    app: {
      name: process.env.APP_NAME || 'sign-language-platform',
      env: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      apiPrefix: process.env.API_PREFIX || 'api',
    },
    database: {
      uri: process.env.MONGODB_URI || '',
    },
    jwt: {
      secret: process.env.JWT_SECRET || '',
      expiresIn: process.env.JWT_EXPIRES_IN || '6d',
      refreshSecret: process.env.JWT_REFRESH_SECRET || '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '604800',
    },
    cors: {
      allowedOrigins,
    },
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'backblaze',
      bucket: process.env.STORAGE_BUCKET || 'sign-language-media',
      baseUrl: process.env.STORAGE_BASE_URL || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_IDs || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEYs || '',
      region: process.env.AWS_REGIONs || 'us-east-1',
      endpoint: process.env.AWS_S3_ENDPOINT || '',
      // Support alternative naming from reference project
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_IDs || '',
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEYs || '',
      awsRegion: process.env.AWS_REGIONs || 'us-east-1',
      s3Endpoint: process.env.AWS_S3_ENDPOINT || '',
    },
    firebase: {
      serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || undefined,
    },
  };
};
