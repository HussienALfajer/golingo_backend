/**
 * Videos Module
 * Module for video management
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { Video, VideoSchema } from './schemas/video.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { Level, LevelSchema } from '../levels/schemas/level.schema';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Level.name, schema: LevelSchema },
    ]),
    MediaModule,
    AuthModule,
  ],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService, MongooseModule],
})
export class VideosModule {}
