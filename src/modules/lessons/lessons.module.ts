import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { Level, LevelSchema } from '../levels/schemas/level.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: Level.name, schema: LevelSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    MediaModule,
  ],
  providers: [LessonsService],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
