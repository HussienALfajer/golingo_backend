/**
 * Progress Module
 * Module for learner progress tracking
 */

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import {
  VideoProgress,
  VideoProgressSchema,
} from './schemas/video-progress.schema';
import {
  CategoryProgress,
  CategoryProgressSchema,
} from './schemas/category-progress.schema';
import {
  LevelProgress,
  LevelProgressSchema,
} from './schemas/level-progress.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from './schemas/lesson-progress.schema';
import { Video, VideoSchema } from '../videos/schemas/video.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { Level, LevelSchema } from '../levels/schemas/level.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VideoProgress.name, schema: VideoProgressSchema },
      { name: CategoryProgress.name, schema: CategoryProgressSchema },
      { name: LevelProgress.name, schema: LevelProgressSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Video.name, schema: VideoSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Level.name, schema: LevelSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
    QuizzesModule,
    NotificationsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
