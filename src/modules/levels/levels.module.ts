/**
 * Levels Module
 * Module for level management
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LevelsService } from './levels.service';
import { LevelsController } from './levels.controller';
import { Level, LevelSchema } from './schemas/level.schema';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Level.name, schema: LevelSchema }]),
    MediaModule,
    AuthModule,
  ],
  controllers: [LevelsController],
  providers: [LevelsService],
  exports: [LevelsService, MongooseModule],
})
export class LevelsModule {}
