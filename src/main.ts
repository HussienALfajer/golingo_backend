/**
 * Main application entry point
 * Configures NestJS application with security, Swagger, validation, etc.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security - Helmet
  // Configure Helmet to work with CORS in development
  const isDevelopment = configService.get<string>('app.env') === 'development';
  app.use(
    helmet({
      crossOriginResourcePolicy: isDevelopment
        ? { policy: 'cross-origin' }
        : { policy: 'same-origin' },
    }),
  );

  // CORS Configuration
  const allowedOrigins = configService.get<string[]>('cors.allowedOrigins');

  app.enableCors({
    // In development, allow all origins for easier Flutter web development
    // In production, use the configured allowed origins
    origin: isDevelopment ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Sign Language Learning Platform API')
    .setDescription('Backend API for sign language learning mobile application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication endpoints')
    .addTag('Levels (Admin)', 'Level management endpoints (Admin only)')
    .addTag('Categories', 'Category management endpoints')
    .addTag('Videos', 'Video management endpoints')
    .addTag('Quizzes', 'Quiz management and submission endpoints')
    .addTag('Progress', 'Learner progress tracking endpoints')
    .addTag('Achievements', 'Achievements and badges endpoints')
    .addTag('Notifications', 'User notifications endpoints')
    .addTag('Media (Admin)', 'Media upload endpoints (Admin only)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start server
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
  );
}

bootstrap();
