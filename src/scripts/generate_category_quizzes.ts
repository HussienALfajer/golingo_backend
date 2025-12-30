// src/scripts/generate_category_quizzes.ts
// Script to generate/update a final quiz for each category
// based on WLASL lessons (similar to QuizzesService.generateCategoryFinalQuizFromLessons)

import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  Quiz,
  QuizDocument,
  QuizSchema,
} from '../modules/quizzes/schemas/quiz.schema';
import { Question } from '../modules/quizzes/schemas/question.schema';
import {
  Lesson,
  LessonDocument,
  LessonSchema,
} from '../modules/lessons/schemas/lesson.schema';
import {
  Category,
  CategoryDocument,
  CategorySchema,
} from '../modules/categories/schemas/category.schema';
import { Level, LevelSchema } from '../modules/levels/schemas/level.schema';
import { QuizType } from '../common/enums/quiz-type.enum';
import { QuestionType } from '../common/enums/question-type.enum';
import { MediaService } from '../modules/media/media.service';

loadEnv();

interface GenerateDeps {
  QuizModel: Model<QuizDocument>;
  LessonModel: Model<LessonDocument>;
  category: CategoryDocument;
  mediaService: MediaService;
}

/**
 * Get random distractors from a list of words
 */
function getRandomDistractors(words: string[], count: number): string[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Generate or update a CATEGORY_FINAL quiz for a single category
 * using its lessons and videos.
 */
async function generateQuizForCategory({
  QuizModel,
  LessonModel,
  category,
  mediaService,
}: GenerateDeps): Promise<QuizDocument | null> {
  const categoryId = category._id;
  console.log(
    `\n[quiz] Generating quiz for category: ${category.title} (${categoryId})`,
  );

  // 1) Load lessons for this category
  const lessons = await LessonModel.find({ categoryId }).exec();
  if (!lessons.length) {
    console.warn('[quiz]  -> No lessons found for this category. Skipping.');
    return null;
  }

  // 2) Collect all lesson words to use as distractors
  const allLessonWords: string[] = [];
  lessons.forEach((lesson) => {
    const word = (lesson.title || lesson.gloss || '').trim();
    if (word) {
      allLessonWords.push(word);
    }
  });

  if (!allLessonWords.length) {
    console.warn('[quiz]  -> Lessons have no titles/glosses. Skipping.');
    return null;
  }

  const questions: Question[] = [];

  // 3) Generate questions from quiz videos
  for (const lesson of lessons) {
    const lessonWord = (lesson.title || lesson.gloss || '').trim();
    if (!lessonWord) continue;

    let videosForQuiz = (lesson as any).videos || [];

    // Filter videos marked as quiz videos
    videosForQuiz = videosForQuiz.filter((v: any) => v.isForQuiz === true);

    // Fallback: if no quiz videos but there is exactly one video, use it
    if (
      (!videosForQuiz || videosForQuiz.length === 0) &&
      (lesson as any).videos?.length === 1
    ) {
      videosForQuiz = (lesson as any).videos;
    }

    if (!videosForQuiz || videosForQuiz.length === 0) {
      continue;
    }

    for (const video of videosForQuiz) {
      const videoId = String(video.videoId);
      const b2Key = video.b2Key as string | undefined;

      if (!b2Key) {
        console.warn(
          `[quiz]    -> Lesson ${lesson._id} video ${videoId} has no b2Key. Skipping this video.`,
        );
        continue;
      }

      const questionId = `${lesson._id}:${videoId}`;
      const correctWord = lessonWord;

      // 3.1) Build distractors from other lesson words
      const distractorsPool = allLessonWords.filter((w) => w !== correctWord);
      const distractors = getRandomDistractors(distractorsPool, 3);

      // 3.2) Build options: correct + distractors
      const options: Array<{ id: string; text: string }> = [];
      const correctOptionId = `opt_${questionId}_correct`;
      options.push({ id: correctOptionId, text: correctWord });

      distractors.forEach((distractor, index) => {
        options.push({
          id: `opt_${questionId}_dist_${index}`,
          text: distractor,
        });
      });

      // Shuffle options
      shuffleArray(options);

      const correctOption = options.find((opt) => opt.text === correctWord);
      if (!correctOption) {
        console.warn(
          `[quiz]    -> Could not find correct option after shuffling for question ${questionId}`,
        );
        continue;
      }

      // 3.3) Convert b2Key to signed URL (watchable URL)
      // This creates a URL like: "https://s3.us-east-005.backblazeb2.com/sign-language-media/asl/L1/family/cousin/13630.mp4?X-Amz-Algorithm=..."
      // The URL can be used directly in <video> tag or video player to watch the video
      let videoUrl: string | null = null;
      try {
        videoUrl = await mediaService.getSignedUrl(b2Key, 3600); // 3600 seconds = 1 hour expiration
      } catch (error) {
        console.warn(
          `[quiz]    -> Failed to generate signed URL for video ${videoId} (${b2Key}):`,
          error,
        );
        // Continue without videoUrl if signed URL generation fails
      }

      if (!videoUrl) {
        console.warn(
          `[quiz]    -> Skipping question ${questionId} because signed URL could not be generated.`,
        );
        continue;
      }

      questions.push({
        questionId,
        type: QuestionType.SINGLE_CHOICE,
        text: 'Select the correct word for this sign',
        videoUrl, // Stored as signed URL (watchable URL)
        options: options as any,
        correctOptionIds: [correctOption.id],
      } as any);
    }
  }

  if (!questions.length) {
    console.warn(
      '[quiz]  -> No questions generated (no quiz videos). Skipping.',
    );
    return null;
  }

  // 4) Create or update Quiz document
  const existingQuiz = await QuizModel.findOne({
    type: QuizType.CATEGORY_FINAL,
    categoryId,
    source: 'WLASL',
  }).exec();

  const quizTitle = `${category.title} - اختبار نهائي للإشارات`;
  const quizDescription =
    'اختبار نهائي للتعرّف على الإشارات اعتمادًا على دروس WLASL.';

  if (existingQuiz) {
    console.log('[quiz]  -> Updating existing quiz:', existingQuiz._id);
    existingQuiz.questions = questions as any;
    existingQuiz.passingScore = 60;
    existingQuiz.title = quizTitle;
    existingQuiz.description = quizDescription;
    existingQuiz.markModified('questions');
    return existingQuiz.save();
  } else {
    console.log('[quiz]  -> Creating new quiz.');
    const quiz = new QuizModel({
      type: QuizType.CATEGORY_FINAL,
      source: 'WLASL',
      categoryId,
      title: quizTitle,
      description: quizDescription,
      passingScore: 60,
      questions,
    });
    return quiz.save();
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('[generate_category_quizzes] Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  // Initialize MediaService to generate signed URLs
  // Create a ConfigService wrapper that reads from process.env directly
  class ScriptConfigService {
    get<T = any>(propertyPath: string, defaultValue?: T): T | undefined {
      // Handle storage.* paths
      if (propertyPath.startsWith('storage.')) {
        const key = propertyPath.replace('storage.', '');

        // Map property names to env var names
        const envVarMap: Record<string, string[]> = {
          provider: ['STORAGE_PROVIDER'],
          bucket: ['STORAGE_BUCKET'],
          baseUrl: ['STORAGE_BASE_URL'],
          accessKeyId: ['STORAGE_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_IDs'],
          awsAccessKeyId: ['AWS_ACCESS_KEY_IDs', 'STORAGE_ACCESS_KEY_ID'],
          secretAccessKey: [
            'STORAGE_SECRET_ACCESS_KEY',
            'AWS_SECRET_ACCESS_KEYs',
          ],
          awsSecretAccessKey: [
            'AWS_SECRET_ACCESS_KEYs',
            'STORAGE_SECRET_ACCESS_KEY',
          ],
          region: ['STORAGE_REGION', 'AWS_REGIONs'],
          awsRegion: ['AWS_REGIONs', 'STORAGE_REGION'],
          endpoint: ['STORAGE_ENDPOINT', 'S3_ENDPOINT'],
          s3Endpoint: ['S3_ENDPOINT', 'STORAGE_ENDPOINT'],
        };

        const envVars = envVarMap[key];
        if (envVars) {
          for (const envVar of envVars) {
            const value = process.env[envVar];
            if (value) {
              return value as T;
            }
          }
        }
      }

      // Fallback: try direct conversion
      const envKey = propertyPath
        .toUpperCase()
        .replace(/\./g, '_')
        .replace(/-/g, '_');

      return (process.env[envKey] as T) || defaultValue;
    }
  }

  const configService = new ScriptConfigService() as any;
  const mediaService = new MediaService(configService);

  // Verify MediaService is configured
  if (!mediaService['s3']) {
    console.error(
      '[generate_category_quizzes] ERROR: MediaService is not configured. ' +
        'Please check your .env file has STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, etc.',
    );
    console.error(
      'Required environment variables:',
      '\n  - STORAGE_PROVIDER (or default: backblaze)',
      '\n  - STORAGE_ACCESS_KEY_ID (or AWS_ACCESS_KEY_IDs)',
      '\n  - STORAGE_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEYs)',
      '\n  - STORAGE_BUCKET (or default: sign-language-media)',
      '\n  - STORAGE_REGION (or AWS_REGIONs, or default: us-east-005)',
    );
    console.error('\nCurrent env vars:', {
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID
        ? '***'
        : undefined,
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY
        ? '***'
        : undefined,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_REGION: process.env.STORAGE_REGION,
    });
    process.exit(1);
  }

  const QuizModel = mongoose.model<QuizDocument>(Quiz.name, QuizSchema as any);
  const LessonModel = mongoose.model<LessonDocument>(
    Lesson.name,
    LessonSchema as any,
  );
  const CategoryModel = mongoose.model<CategoryDocument>(
    Category.name,
    CategorySchema as any,
  );
  const LevelModel = mongoose.model(Level.name, LevelSchema);

  // CLI arg: ALL or specific level code (e.g. L1, L2, ...)
  const levelArg = (process.argv[2] || 'ALL').toUpperCase();

  let categories: CategoryDocument[] = [];

  if (levelArg === 'ALL') {
    console.log(
      '[generate_category_quizzes] Generating quizzes for ALL categories',
    );
    categories = await CategoryModel.find({ isActive: true }).exec();
  } else {
    console.log(
      `[generate_category_quizzes] Generating quizzes for categories in level ${levelArg}`,
    );
    const level = await LevelModel.findOne({ code: levelArg }).exec();
    if (!level) {
      throw new Error(`Level with code ${levelArg} not found in database`);
    }
    categories = await CategoryModel.find({
      levelId: level._id,
      isActive: true,
    }).exec();
  }

  console.log(
    `[generate_category_quizzes] Found ${categories.length} active categories to process.`,
  );

  let createdOrUpdated = 0;
  let skipped = 0;

  for (const category of categories) {
    try {
      const quiz = await generateQuizForCategory({
        QuizModel,
        LessonModel,
        category,
        mediaService,
      });
      if (quiz) {
        createdOrUpdated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(
        `[generate_category_quizzes] Error while generating quiz for category ${category._id}:`,
        err,
      );
      skipped++;
    }
  }

  console.log(
    `[generate_category_quizzes] Done. Created/updated quizzes: ${createdOrUpdated}, skipped: ${skipped}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
