// src/scripts/seed_wlasl_lessons.ts
// Use comments in English

import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as mongoose from 'mongoose';
import {
  Lesson,
  LessonDocument,
  LessonSchema,
} from '../modules/lessons/schemas/lesson.schema';
import { Level, LevelSchema } from '../modules/levels/schemas/level.schema';
import {
  Category,
  CategoryDocument,
  CategorySchema,
} from '../modules/categories/schemas/category.schema';

loadEnv();

interface CategoryConfig {
  name_en: string;
  name_ar: string;
  glosses: string[];
}

interface LevelConfig {
  name_en: string;
  name_ar: string;
  categories: Record<string, CategoryConfig>;
}

interface LevelsConfig {
  [levelCode: string]: LevelConfig;
}

interface WlaslInstance {
  video_id: string;
}

interface WlaslGloss {
  gloss: string;
  instances: WlaslInstance[];
}

async function main() {
  // 0) CLI args
  // Usage: ts-node seed_wlasl_lessons.ts <LEVEL_CODE> <WLASL_JSON_PATH>
  const levelCode = (process.argv[2] || 'L1').toUpperCase();
  const wlaslJsonPath =
    process.argv[3] ||
    path.join(__dirname, '..', '..', '..', 'data', 'WLASL_v0.3.json');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('[seed_wlasl_lessons] Level code:', levelCode);
  console.log('[seed_wlasl_lessons] WLASL JSON path:', wlaslJsonPath);
  console.log('[seed_wlasl_lessons] Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  const LessonModel = mongoose.model<LessonDocument>(
    Lesson.name,
    LessonSchema as any,
  );
  const LevelModel = mongoose.model(Level.name, LevelSchema);
  const CategoryModel = mongoose.model<CategoryDocument>(
    Category.name,
    CategorySchema as any,
  );

  // 1) Load level/category config
  const levelsConfigPath = path.join(
    __dirname,
    '..',
    'config',
    'wlasl_levels.json',
  );
  console.log(
    '[seed_wlasl_lessons] Loading levels config from:',
    levelsConfigPath,
  );
  const levelsRaw = fs.readFileSync(levelsConfigPath, 'utf8');
  const levelsConfig: LevelsConfig = JSON.parse(levelsRaw);

  const levelConfig = levelsConfig[levelCode];
  if (!levelConfig) {
    throw new Error(`Level ${levelCode} not found in wlasl_levels.json`);
  }

  // 2) Find Level by code
  const level = await LevelModel.findOne({ code: levelCode }).exec();
  console.log('[seed_wlasl_lessons] Level found in DB:', level);
  if (!level) {
    throw new Error(`Level with code ${levelCode} not found in database`);
  }

  // 3) Build gloss -> categorySlug map from config
  const glossToCategorySlug = new Map<string, string>();

  for (const [categorySlug, category] of Object.entries(
    levelConfig.categories,
  )) {
    for (const gloss of category.glosses) {
      glossToCategorySlug.set(gloss.toLowerCase(), categorySlug);
    }
  }

  console.log(
    '[seed_wlasl_lessons] Level config has',
    glossToCategorySlug.size,
    'glosses mapped to categories.',
  );

  // 4) Build a map of {categorySlug -> CategoryDocument}
  const categoryDocs = new Map<string, CategoryDocument>();

  for (const categorySlug of Object.keys(levelConfig.categories)) {
    // First try strict match by levelId + code
    let categoryDoc = await CategoryModel.findOne({
      levelId: level._id,
      code: categorySlug,
    }).exec();

    // Fallback: try by code only (in case levelId mismatch)
    if (!categoryDoc) {
      console.warn(
        `[seed_wlasl_lessons] Category with code ${categorySlug} not found for level ${levelCode} using levelId. Trying by code only...`,
      );
      categoryDoc = await CategoryModel.findOne({
        code: categorySlug,
      }).exec();
    }

    if (!categoryDoc) {
      console.warn(
        `[seed_wlasl_lessons] Category STILL not found for slug ${categorySlug}. Skipping this category.`,
      );
      continue;
    }

    console.log(
      `[seed_wlasl_lessons] Category resolved for slug ${categorySlug}:`,
      (categoryDoc._id as mongoose.Types.ObjectId | string).toString(),
      'levelId=',
      categoryDoc.levelId.toString(),
    );

    categoryDocs.set(categorySlug, categoryDoc as CategoryDocument);
  }

  // 5) Load WLASL_v0.3.json
  console.log('[seed_wlasl_lessons] Loading WLASL data from:', wlaslJsonPath);

  const wlaslRaw = fs.readFileSync(wlaslJsonPath, 'utf8');
  const wlaslData: WlaslGloss[] = JSON.parse(wlaslRaw);

  // 6) For each gloss in WLASL, create/update Lesson
  let lessonCount = 0;

  for (const entry of wlaslData) {
    const gloss = (entry.gloss || '').toLowerCase();
    const categorySlug = glossToCategorySlug.get(gloss);
    if (!categorySlug) {
      continue; // this gloss is not part of this level config
    }

    const categoryDoc = categoryDocs.get(categorySlug);
    if (!categoryDoc) {
      console.warn(
        `[seed_wlasl_lessons] Category document not found for slug ${categorySlug} (gloss=${gloss}). Skipping this lesson.`,
      );
      continue;
    }

    const instances = entry.instances || [];
    if (!instances.length) {
      continue;
    }

    // Sort instances by video_id (as a simple stable ordering)
    instances.sort((a, b) => {
      const av = Number(a.video_id);
      const bv = Number(b.video_id);
      return av - bv;
    });

    const b2FolderKey = `asl/${levelCode}/${categorySlug}/${gloss}`;

    const videos = instances.map((inst, index) => {
      const isLast = index === instances.length - 1;
      const onlyOne = instances.length === 1;

      return {
        videoId: String(inst.video_id),
        b2Key: `${b2FolderKey}/${inst.video_id}.mp4`,
        order: index,
        isForLesson: onlyOne || !isLast,
        isForQuiz: onlyOne || isLast,
      };
    });

    await LessonModel.updateOne(
      { categoryId: categoryDoc._id, gloss },
      {
        $set: {
          levelId: level._id,
          categoryId: categoryDoc._id,
          gloss,
          title: gloss,
          b2FolderKey,
          videos,
          isActive: true,
        },
      },
      { upsert: true },
    );

    lessonCount++;
  }

  console.log(`Seeded/updated ${lessonCount} lessons for level ${levelCode}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
