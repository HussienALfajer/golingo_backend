/**
 * Quizzes Module
 * Module for quiz management and submissions
 */

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema';
import { Lesson, LessonSchema } from '../lessons/schemas/lesson.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { ProgressModule } from '../progress/progress.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    forwardRef(() => ProgressModule),
    MediaModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService, MongooseModule],
})
export class QuizzesModule {}
