// src/scripts/seed_wlasl_levels_and_categories.ts
// This script creates/updates Levels and Categories in MongoDB
// based on src/config/wlasl_levels.json (L1..L5).

import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as mongoose from 'mongoose';
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

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log(
    '[seed_wlasl_levels_and_categories] Connecting to MongoDB:',
    mongoUri,
  );
  await mongoose.connect(mongoUri);

  const LevelModel = mongoose.model(Level.name, LevelSchema);
  const CategoryModel = mongoose.model<CategoryDocument>(
    Category.name,
    CategorySchema as any,
  );

  // 1) Load levels config (L1..L5)
  const levelsConfigPath = path.join(
    __dirname,
    '..',
    'config',
    'wlasl_levels.json',
  );
  console.log(
    '[seed_wlasl_levels_and_categories] Loading config from:',
    levelsConfigPath,
  );

  const levelsRaw = fs.readFileSync(levelsConfigPath, 'utf8');
  const levelsConfig: LevelsConfig = JSON.parse(levelsRaw);

  let totalLevels = 0;
  let totalCategories = 0;

  for (const [levelCodeRaw, levelConfig] of Object.entries(levelsConfig)) {
    const levelCode = levelCodeRaw.toUpperCase();

    // Derive numeric order from code (e.g. L1 -> 1, L2 -> 2)
    const numericOrder =
      parseInt(levelCode.replace(/^\D+/, ''), 10) || totalLevels + 1;

    // Backblaze folder path convention: levels/level-<order>
    const backblazeFolderPath = `levels/level-${numericOrder}`;

    // Use Arabic name as title if available
    const levelTitle = levelConfig.name_ar || levelConfig.name_en;
    const levelDescription = `مستوى ${levelConfig.name_ar || levelConfig.name_en} في منهج لغة الإشارة.`;

    console.log(
      `[seed_wlasl_levels_and_categories] Upserting level ${levelCode} (${levelTitle})`,
    );

    // 2) Upsert Level
    const levelDoc = await LevelModel.findOneAndUpdate(
      { code: levelCode },
      {
        $set: {
          code: levelCode,
          title: levelTitle,
          description: levelDescription,
          order: numericOrder,
          isActive: true,
          backblazeFolderPath,
        },
      },
      { upsert: true, new: true },
    ).exec();

    totalLevels++;

    // 3) Upsert Categories for this level
    let categoryOrder = 1;
    for (const [categorySlug, categoryConfig] of Object.entries(
      levelConfig.categories,
    )) {
      const categoryTitle = categoryConfig.name_ar || categoryConfig.name_en;
      const categoryDescription = `فئة ${categoryTitle} ضمن ${levelTitle}.`;

      console.log(
        `[seed_wlasl_levels_and_categories]  - Upserting category ${categorySlug} (${categoryTitle})`,
      );

      await CategoryModel.findOneAndUpdate(
        { code: categorySlug, levelId: levelDoc._id },
        {
          $set: {
            levelId: levelDoc._id,
            code: categorySlug,
            title: categoryTitle,
            description: categoryDescription,
            order: categoryOrder,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      ).exec();

      categoryOrder++;
      totalCategories++;
    }
  }

  console.log(
    `[seed_wlasl_levels_and_categories] Done. Levels: ${totalLevels}, Categories: ${totalCategories}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
