/**
 * Achievement Definition Schema
 * MongoDB schema for achievement definitions (already exists in achievements module)
 * This file is kept for reference but we'll use the existing Achievement schema
 */

// Note: Achievement schema already exists in modules/achievements/schemas/achievement.schema.ts
// We'll import and use that instead of duplicating

export {
  Achievement,
  AchievementSchema,
} from '../../achievements/schemas/achievement.schema';
export type { AchievementDocument } from '../../achievements/schemas/achievement.schema';
