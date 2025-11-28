/**
 * Progress Service
 * Service for managing learner progress and unlocking logic
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VideoProgress,
  VideoProgressDocument,
} from './schemas/video-progress.schema';
import {
  CategoryProgress,
  CategoryProgressDocument,
} from './schemas/category-progress.schema';
import {
  LevelProgress,
  LevelProgressDocument,
} from './schemas/level-progress.schema';
import {
  LessonProgress,
  LessonProgressDocument,
} from './schemas/lesson-progress.schema';
import { Video, VideoDocument } from '../videos/schemas/video.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { Level, LevelDocument } from '../levels/schemas/level.schema';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from '../quizzes/schemas/quiz-attempt.schema';
import { QuizzesService } from '../quizzes/quizzes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuizType } from '../../common/enums/quiz-type.enum';
import { EntityType } from '../../common/enums/entity-type.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import {
  toObjectId,
  objectIdToString,
} from '../../common/utils/object-id.util';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @InjectModel(VideoProgress.name)
    private videoProgressModel: Model<VideoProgressDocument>,
    @InjectModel(CategoryProgress.name)
    private categoryProgressModel: Model<CategoryProgressDocument>,
    @InjectModel(LevelProgress.name)
    private levelProgressModel: Model<LevelProgressDocument>,
    @InjectModel(LessonProgress.name)
    private lessonProgressModel: Model<LessonProgressDocument>,
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Level.name) private levelModel: Model<LevelDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private quizzesService: QuizzesService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Mark a video within a lesson as watched
   */
  async markLessonVideoWatched(
    userId: string,
    lessonId: string,
    videoId: string,
  ): Promise<LessonProgressDocument> {
    // Validate and convert to ObjectIds using utility
    const userObjectId = toObjectId(userId, 'userId');
    const lessonObjectId = toObjectId(lessonId, 'lessonId');

    // Validate lesson exists
    const lesson = await this.lessonModel.findById(lessonObjectId).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check if the video belongs to this lesson
    const videoInLesson = lesson.videos.find(v => v.videoId === videoId);
    if (!videoInLesson) {
      throw new BadRequestException('Video does not belong to this lesson');
    }

    // Get or create lesson progress - use ObjectIds for proper matching
    let progress = await this.lessonProgressModel
      .findOne({ userId: userObjectId, lessonId: lessonObjectId })
      .exec();

    if (!progress) {
      // Check if lesson is unlocked
      const isUnlocked = await this.isLessonUnlocked(userId, lessonId);
      if (!isUnlocked) {
        throw new BadRequestException(
          'Lesson is locked. Complete previous lessons first.',
        );
      }

      progress = new this.lessonProgressModel({
        userId: userObjectId,
        lessonId: lessonObjectId,
        watchedVideos: [],
        allVideosWatched: false,
        unlockedAt: new Date(),
      });
    }

    // Normalize video IDs to strings for consistent comparison
    const normalizedVideoId = String(videoId);
    
    // Get lesson video IDs (only videos for lessons, not quiz) - normalize to strings
    const lessonVideoIds = lesson.videos
      .filter(v => v.isForLesson)
      .map(v => String(v.videoId));
    
    // Normalize watched videos to strings for consistent comparison
    const normalizedWatchedVideos = progress.watchedVideos.map(v => String(v));
    
    // Add video to watched list if not already watched (using normalized comparison)
    if (!normalizedWatchedVideos.includes(normalizedVideoId)) {
      // Use normalized string version
      progress.watchedVideos.push(normalizedVideoId);
    }
    
    // Always check if lesson is complete (even if video was already watched)
    // This handles cases where video was added before but completion check wasn't run
    const currentWatchedVideos = progress.watchedVideos.map(v => String(v));
    const allWatched = lessonVideoIds.length > 0 && 
      lessonVideoIds.every(vid => currentWatchedVideos.includes(String(vid)));

    // Only mark as completed if not already marked
    if (allWatched && !progress.allVideosWatched) {
      // Mark lesson as completed
      progress.allVideosWatched = true;
      progress.completedAt = new Date();
      await progress.save();
      
      this.logger.log(`Lesson ${lessonId} completed (${currentWatchedVideos.length}/${lessonVideoIds.length} videos watched). Unlocking next lesson...`);
      
        // Unlock next lesson after marking as completed
        try {
          await this.handleLessonCompleted(userId, (lessonObjectId as any).toString());
          this.logger.log(`Successfully processed lesson completion for ${lessonId}`);
        } catch (error) {
          this.logger.error(`Error handling lesson completion for ${lessonId}: ${error.message}`);
          // Don't throw - the lesson is already marked as completed
        }
    } else if (!allWatched) {
      // Save progress if not all videos watched yet (only if we added a new video)
      if (!normalizedWatchedVideos.includes(normalizedVideoId)) {
        await progress.save();
      }
    } else if (allWatched && progress.allVideosWatched) {
      // Lesson already completed - check if next lesson needs to be unlocked
      // This handles edge cases where completion was set but unlock didn't happen
      this.logger.debug(`Lesson ${lessonId} already marked as completed. Verifying next lesson is unlocked...`);
      try {
        await this.unlockNextLesson(userId, (lessonObjectId as any).toString());
      } catch (error) {
        this.logger.warn(`Error verifying next lesson unlock for ${lessonId}: ${error.message}`);
      }
    }

    return progress;
  }

  /**
   * Update category progress after category final quiz attempt
   */
  async updateCategoryProgressAfterQuiz(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Find category final quiz
    const quiz = await this.quizzesService.findByCategory(categoryId);
    if (!quiz) {
      return; // No quiz for this category
    }

    // Get best score
    const bestScore = await this.quizzesService.getBestScore(
      quiz._id.toString(),
      userId,
    );
    const passed = bestScore >= 60; // Fixed 60% passing score

    // Get or create category progress
    let categoryProgress = await this.categoryProgressModel
      .findOne({ userId, categoryId })
      .exec();

    if (!categoryProgress) {
      categoryProgress = new this.categoryProgressModel({
        userId,
        categoryId,
        finalQuizPassed: false,
        unlockedAt: new Date(),
      });
    }

    // Update best score and passed status
    if (
      !categoryProgress.finalQuizBestScore ||
      bestScore > categoryProgress.finalQuizBestScore
    ) {
      categoryProgress.finalQuizBestScore = bestScore;
    }

    // Mark as passed if score >= 60 (even if already passed before)
    if (passed && !categoryProgress.finalQuizPassed) {
      categoryProgress.finalQuizPassed = true;
      categoryProgress.completedAt = new Date();

      await this.handleCategoryCompleted(userId, categoryId);
    } else if (passed && categoryProgress.finalQuizPassed) {
      // Already passed, but ensure next category is unlocked
      // This handles cases where unlock might have failed previously
      await this.unlockNextCategory(userId, categoryId);
    }

    await categoryProgress.save();
  }

  /**
   * Check if lesson is unlocked for user
   */
  async isLessonUnlocked(userId: string, lessonId: string): Promise<boolean> {
    // Convert to ObjectIds consistently
    const userObjectId = toObjectId(userId, 'userId');
    const lessonObjectId = toObjectId(lessonId, 'lessonId');

    const lesson = await this.lessonModel.findById(lessonObjectId).exec();
    if (!lesson) {
      return false;
    }

    // Check if user already has progress for this lesson
    const progress = await this.lessonProgressModel
      .findOne({ userId: userObjectId, lessonId: lessonObjectId })
      .exec();

    if (progress) {
      return true; // Already has progress, consider unlocked
    }

    // Check if category is unlocked
    const category = await this.categoryModel.findById(lesson.categoryId).exec();
    if (!category) {
      return false;
    }

    const categoryUnlocked = await this.isCategoryUnlocked(
      userId,
      objectIdToString(category._id),
    );
    if (!categoryUnlocked) {
      return false;
    }

    // Get all lessons in category sorted by order
    const allLessons = await this.lessonModel
      .find({ categoryId: category._id, isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .exec();

    // Find current lesson index
    const currentIndex = allLessons.findIndex(
      (l) => objectIdToString(l._id) === lessonId,
    );

    if (currentIndex === -1) {
      return false;
    }

    // If this is the first lesson in the category, it's unlocked
    if (currentIndex === 0) {
      return true;
    }

    // Check if previous lesson is completed
    const previousLesson = allLessons[currentIndex - 1];
    if (!previousLesson) {
      return false;
    }

    const previousProgress = await this.lessonProgressModel
      .findOne({
        userId: userObjectId,
        lessonId: previousLesson._id,
      })
      .exec();

    return previousProgress?.allVideosWatched === true;
  }


  /**
   * Check if category is unlocked for user
   */
  async isCategoryUnlocked(
    userId: string,
    categoryId: string,
  ): Promise<boolean> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      return false;
    }

    // Get category progress
    const categoryProgress = await this.categoryProgressModel
      .findOne({ userId, categoryId })
      .exec();
    if (categoryProgress && categoryProgress.unlockedAt) {
      return true;
    }

    // Check if level is unlocked
    const levelProgress = await this.levelProgressModel
      .findOne({ userId, levelId: category.levelId })
      .exec();
    if (!levelProgress || !levelProgress.unlockedAt) {
      return false; // Level not unlocked
    }

    // If this is the first category in the level, it's unlocked
    const firstCategory = await this.categoryModel
      .findOne({ levelId: category.levelId, isActive: true, deletedAt: null })
      .sort({ order: 1 })
      .exec();

    if (firstCategory && (firstCategory._id as any).toString() === categoryId) {
      return true;
    }

    // Check if previous category is completed
    const previousCategory = await this.categoryModel
      .findOne({
        levelId: category.levelId,
        order: category.order - 1,
        isActive: true,
        deletedAt: null,
      })
      .exec();

    if (!previousCategory) {
      return false;
    }

    const previousProgress = await this.categoryProgressModel
      .findOne({ userId, categoryId: previousCategory._id })
      .exec();
    return previousProgress?.finalQuizPassed === true;
  }

  /**
   * Check if level is unlocked for user
   */
  async isLevelUnlocked(userId: string, levelId: string): Promise<boolean> {
    // Level 1 is always unlocked
    const level = await this.levelModel.findById(levelId).exec();
    if (!level) {
      return false;
    }

    if (level.order === 1) {
      return true;
    }

    // Get level progress
    const levelProgress = await this.levelProgressModel
      .findOne({ userId, levelId })
      .exec();
    if (levelProgress && levelProgress.unlockedAt) {
      return true;
    }

    // Find previous level
    const previousLevel = await this.levelModel
      .findOne({ order: level.order - 1, isActive: true, deletedAt: null })
      .exec();

    if (!previousLevel) {
      return false;
    }

    const previousProgress = await this.levelProgressModel
      .findOne({ userId, levelId: previousLevel._id })
      .exec();
    return previousProgress?.allCategoriesCompleted === true;
  }

  /**
   * Handle lesson completion - unlock next lesson
   */
  private async handleLessonCompleted(
    userId: string,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.lessonModel.findById(lessonId).exec();
    if (!lesson) {
      return;
    }

    // Create notification
    await this.notificationsService.create({
      userId,
      type: NotificationType.PROGRESS,
      title: 'Lesson Completed!',
      message: `Congratulations! You completed "${lesson.title}"`,
      relatedEntityType: EntityType.LESSON,
      relatedEntityId: lesson._id,
    });

    // Unlock next lesson
    await this.unlockNextLesson(userId, lessonId);
  }

  /**
   * Unlock next lesson in category
   */
  private async unlockNextLesson(
    userId: string,
    lessonId: string,
  ): Promise<void> {
    const userObjectId = toObjectId(userId, 'userId');

    try {
      const lesson = await this.lessonModel.findById(lessonId).exec();
      if (!lesson) {
        this.logger.warn(`Lesson ${lessonId} not found when trying to unlock next lesson`);
        return;
      }

      // Get all lessons in category sorted by order
      const allLessons = await this.lessonModel
        .find({ categoryId: lesson.categoryId, isActive: true })
        .sort({ order: 1, createdAt: 1 })
        .exec();

      // Find current lesson index
      const currentIndex = allLessons.findIndex(
        (l) => objectIdToString(l._id) === lessonId,
      );

      if (currentIndex === -1) {
        this.logger.warn(`Current lesson ${lessonId} not found in category lessons list`);
        return;
      }

      // Check if there's a next lesson
      if (currentIndex >= allLessons.length - 1) {
        this.logger.debug(`No next lesson found after lesson ${lessonId} - last lesson in category`);
        return;
      }

      const nextLesson = allLessons[currentIndex + 1];

      // Check if already has progress - use ObjectId consistently
      let nextProgress = await this.lessonProgressModel
        .findOne({ userId: userObjectId, lessonId: nextLesson._id })
        .exec();

      if (!nextProgress) {
        // Create progress for next lesson with ObjectId
        nextProgress = new this.lessonProgressModel({
          userId: userObjectId,
          lessonId: nextLesson._id,
          watchedVideos: [],
          allVideosWatched: false,
          unlockedAt: new Date(),
        });
        await nextProgress.save();
        this.logger.log(`Created progress record for next lesson ${nextLesson._id}`);

        // Create notification
        try {
          await this.notificationsService.create({
            userId,
            type: NotificationType.UNLOCK,
            title: 'New Lesson Unlocked!',
            message: `You unlocked "${nextLesson.title}"`,
            relatedEntityType: EntityType.LESSON,
            relatedEntityId: nextLesson._id,
          });
        } catch (notifError) {
          this.logger.warn(`Failed to create notification for lesson ${nextLesson._id}: ${notifError.message}`);
        }
      } else if (!nextProgress.unlockedAt) {
        nextProgress.unlockedAt = new Date();
        await nextProgress.save();
        this.logger.debug(`Updated progress record to mark lesson ${nextLesson._id} as unlocked`);
      }
    } catch (error) {
      this.logger.error(`Error unlocking next lesson after ${lessonId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle category completion - unlock next category
   */
  private async handleCategoryCompleted(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      return;
    }

    // Create notification
    await this.notificationsService.create({
      userId,
      type: NotificationType.PROGRESS,
      title: 'Category Completed!',
      message: `Congratulations! You completed "${category.title}"`,
      relatedEntityType: EntityType.CATEGORY,
      relatedEntityId: category._id,
    });

    // Unlock next category
    await this.unlockNextCategory(userId, categoryId);

    // Update level progress
    await this.updateLevelProgress(userId, category.levelId.toString());
  }

  /**
   * Unlock next category in level
   */
  private async unlockNextCategory(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      return;
    }

    // If this is the first category (order === 1) in the level,
    // unlock the first category of the next level instead
    if (category.order === 1) {
      // Get the level to find the next level
      const level = await this.levelModel.findById(category.levelId).exec();
      if (!level) {
        return;
      }

      // Find next level
      const nextLevel = await this.levelModel
        .findOne({ order: level.order + 1, isActive: true, deletedAt: null })
        .exec();

      if (nextLevel) {
        // Find first category in next level
        const firstCategoryInNextLevel = await this.categoryModel
          .findOne({
            levelId: nextLevel._id,
            isActive: true,
            deletedAt: null,
          })
          .sort({ order: 1 })
          .exec();

        if (firstCategoryInNextLevel) {
          // Unlock the first category of the next level
          await this.unlockCategoryAndFirstLesson(
            userId,
            firstCategoryInNextLevel,
          );
          return;
        }
      }
    }

    // For categories with order > 1, find next category in same level
    const nextCategory = await this.categoryModel
      .findOne({
        levelId: category.levelId,
        order: category.order + 1,
        isActive: true,
        deletedAt: null,
      })
      .exec();

    if (nextCategory) {
      await this.unlockCategoryAndFirstLesson(userId, nextCategory);
    } else {
      // No next category in same level - check if we should unlock first category of next level
      // This handles the case where the last category in a level is completed
      const level = await this.levelModel.findById(category.levelId).exec();
      if (!level) {
        return;
      }

      // Find next level
      const nextLevel = await this.levelModel
        .findOne({ order: level.order + 1, isActive: true, deletedAt: null })
        .exec();

      if (nextLevel) {
        // Find first category in next level
        const firstCategoryInNextLevel = await this.categoryModel
          .findOne({
            levelId: nextLevel._id,
            isActive: true,
            deletedAt: null,
          })
          .sort({ order: 1 })
          .exec();

        if (firstCategoryInNextLevel) {
          // Unlock the first category of the next level
          await this.unlockCategoryAndFirstLesson(
            userId,
            firstCategoryInNextLevel,
          );
        }
      }
    }
  }

  /**
   * Helper method to unlock a category and its first lesson
   */
  private async unlockCategoryAndFirstLesson(
    userId: string,
    category: CategoryDocument,
  ): Promise<void> {
    // Check if already has progress
    let nextProgress = await this.categoryProgressModel
      .findOne({ userId, categoryId: category._id })
      .exec();
    if (!nextProgress) {
      nextProgress = new this.categoryProgressModel({
        userId,
        categoryId: category._id,
        finalQuizPassed: false,
        unlockedAt: new Date(),
      });
      await nextProgress.save();
    } else if (!nextProgress.unlockedAt) {
      // Ensure it's marked as unlocked even if progress already exists
      nextProgress.unlockedAt = new Date();
      await nextProgress.save();
    }

    // Unlock first lesson in category
    const firstLesson = await this.lessonModel
      .findOne({
        categoryId: category._id,
        isActive: true,
      })
      .sort({ order: 1 })
      .exec();

    if (firstLesson) {
      let lessonProgress = await this.lessonProgressModel
        .findOne({ userId, lessonId: firstLesson._id })
        .exec();
      if (!lessonProgress) {
        lessonProgress = new this.lessonProgressModel({
          userId,
          lessonId: firstLesson._id,
          watchedVideos: [],
          allVideosWatched: false,
          unlockedAt: new Date(),
        });
        await lessonProgress.save();
      } else if (!lessonProgress.unlockedAt) {
        // Ensure it's marked as unlocked even if progress already exists
        lessonProgress.unlockedAt = new Date();
        await lessonProgress.save();
      }
    }

    // Create notification
    await this.notificationsService.create({
      userId,
      type: NotificationType.UNLOCK,
      title: 'New Category Unlocked!',
      message: `You unlocked "${category.title}"`,
      relatedEntityType: EntityType.CATEGORY,
      relatedEntityId: category._id,
    });
  }

  /**
   * Update level progress
   */
  private async updateLevelProgress(
    userId: string,
    levelId: string,
  ): Promise<void> {
    // Get all categories in level
    const categories = await this.categoryModel
      .find({ levelId, isActive: true, deletedAt: null })
      .exec();

    // Check if all categories are completed
    let allCompleted = true;
    for (const category of categories) {
      const progress = await this.categoryProgressModel
        .findOne({ userId, categoryId: category._id })
        .exec();
      if (!progress || !progress.finalQuizPassed) {
        allCompleted = false;
        break;
      }
    }

    // Get or create level progress
    let levelProgress = await this.levelProgressModel
      .findOne({ userId, levelId })
      .exec();

    if (!levelProgress) {
      levelProgress = new this.levelProgressModel({
        userId,
        levelId,
        allCategoriesCompleted: false,
        unlockedAt: new Date(),
      });
    }

    if (allCompleted && !levelProgress.allCategoriesCompleted) {
      levelProgress.allCategoriesCompleted = true;
      levelProgress.completedAt = new Date();

      const level = await this.levelModel.findById(levelId).exec();
      if (level) {
        // Create notification
        await this.notificationsService.create({
          userId,
          type: NotificationType.PROGRESS,
          title: 'Level Completed!',
          message: `Congratulations! You completed "${level.title}"`,
          relatedEntityType: EntityType.LEVEL,
          relatedEntityId: level._id,
        });

        // Unlock next level
        await this.unlockNextLevel(userId, levelId);
      }
    }

    await levelProgress.save();
  }

  /**
   * Unlock next level
   */
  private async unlockNextLevel(
    userId: string,
    levelId: string,
  ): Promise<void> {
    const level = await this.levelModel.findById(levelId).exec();
    if (!level) {
      return;
    }

    // Find next level
    const nextLevel = await this.levelModel
      .findOne({ order: level.order + 1, isActive: true, deletedAt: null })
      .exec();

    if (nextLevel) {
      // Check if already has progress
      let nextProgress = await this.levelProgressModel
        .findOne({ userId, levelId: nextLevel._id })
        .exec();
      if (!nextProgress) {
        nextProgress = new this.levelProgressModel({
          userId,
          levelId: nextLevel._id,
          allCategoriesCompleted: false,
          unlockedAt: new Date(),
        });
        await nextProgress.save();
      } else if (!nextProgress.unlockedAt) {
        // Ensure it's marked as unlocked even if progress already exists
        nextProgress.unlockedAt = new Date();
        await nextProgress.save();
      }

      // Unlock first category in next level
      const firstCategory = await this.categoryModel
        .findOne({ levelId: nextLevel._id, isActive: true, deletedAt: null })
        .sort({ order: 1 })
        .exec();

      if (firstCategory) {
        let categoryProgress = await this.categoryProgressModel
          .findOne({ userId, categoryId: firstCategory._id })
          .exec();
        if (!categoryProgress) {
          categoryProgress = new this.categoryProgressModel({
            userId,
            categoryId: firstCategory._id,
            finalQuizPassed: false,
            unlockedAt: new Date(),
          });
          await categoryProgress.save();
        } else if (!categoryProgress.unlockedAt) {
          // Ensure it's marked as unlocked even if progress already exists
          categoryProgress.unlockedAt = new Date();
          await categoryProgress.save();
        }

        // Unlock first lesson in first category
        const firstLesson = await this.lessonModel
          .findOne({
            categoryId: firstCategory._id,
            isActive: true,
          })
          .sort({ order: 1 })
          .exec();

        if (firstLesson) {
          let lessonProgress = await this.lessonProgressModel
            .findOne({ userId, lessonId: firstLesson._id })
            .exec();
          if (!lessonProgress) {
            lessonProgress = new this.lessonProgressModel({
              userId,
              lessonId: firstLesson._id,
              watchedVideos: [],
              allVideosWatched: false,
              unlockedAt: new Date(),
            });
            await lessonProgress.save();
          } else if (!lessonProgress.unlockedAt) {
            // Ensure it's marked as unlocked even if progress already exists
            lessonProgress.unlockedAt = new Date();
            await lessonProgress.save();
          }
        }
      }

      // Create notification
      await this.notificationsService.create({
        userId,
        type: NotificationType.UNLOCK,
        title: 'New Level Unlocked!',
        message: `You unlocked "${nextLevel.title}"`,
        relatedEntityType: EntityType.LEVEL,
        relatedEntityId: nextLevel._id,
      });
    }
  }

  /**
   * Initialize progress for new learner (unlock level 1)
   */
  async initializeProgressForNewLearner(userId: string): Promise<void> {
    // Find level 1
    const level1 = await this.levelModel
      .findOne({ order: 1, isActive: true, deletedAt: null })
      .exec();
    if (!level1) {
      return; // No level 1 found
    }

    // Create level progress
    let levelProgress = await this.levelProgressModel
      .findOne({ userId, levelId: level1._id })
      .exec();
    if (!levelProgress) {
      levelProgress = new this.levelProgressModel({
        userId,
        levelId: level1._id,
        allCategoriesCompleted: false,
        unlockedAt: new Date(),
      });
      await levelProgress.save();
    }

    // Find first category in level 1
    const firstCategory = await this.categoryModel
      .findOne({ levelId: level1._id, isActive: true, deletedAt: null })
      .sort({ order: 1 })
      .exec();

    if (firstCategory) {
      // Create category progress
      let categoryProgress = await this.categoryProgressModel
        .findOne({ userId, categoryId: firstCategory._id })
        .exec();
      if (!categoryProgress) {
        categoryProgress = new this.categoryProgressModel({
          userId,
          categoryId: firstCategory._id,
          finalQuizPassed: false,
          unlockedAt: new Date(),
        });
        await categoryProgress.save();
      }

      // Find first lesson in first category
      const firstLesson = await this.lessonModel
        .findOne({
          categoryId: firstCategory._id,
          isActive: true,
        })
        .sort({ order: 1 })
        .exec();

      if (firstLesson) {
        // Create lesson progress
        let lessonProgress = await this.lessonProgressModel
          .findOne({ userId, lessonId: firstLesson._id })
          .exec();
        if (!lessonProgress) {
          lessonProgress = new this.lessonProgressModel({
            userId,
            lessonId: firstLesson._id,
            watchedVideos: [],
            allVideosWatched: false,
            unlockedAt: new Date(),
          });
          await lessonProgress.save();
        }
      }
    }
  }

  /**
   * Get level progress for user
   */
  async getLevelProgress(userId: string, levelId: string) {
    // Validate and convert userId to ObjectId (for fallback queries)
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    const userObjectId = new Types.ObjectId(userId);

    // Validate and convert levelId to ObjectId
    if (!Types.ObjectId.isValid(levelId)) {
      throw new BadRequestException('Invalid levelId');
    }
    const levelObjectId = new Types.ObjectId(levelId);

    const level = await this.levelModel.findById(levelObjectId).exec();
    if (!level) {
      throw new NotFoundException('Level not found');
    }

    const levelProgress = await this.levelProgressModel
      .findOne({ userId, levelId: levelObjectId })
      .exec();
    const isUnlocked = levelProgress?.unlockedAt
      ? true
      : await this.isLevelUnlocked(userId, levelId);

    // Get all categories in level - convert levelId to ObjectId for query
    const categories = await this.categoryModel
      .find({ levelId: levelObjectId, isActive: true, deletedAt: null })
      .sort({ order: 1 })
      .exec();

    // Get category progresses
    const categoryProgresses = await Promise.all(
      categories.map(async (category) => {
        // Query category progress - try multiple query formats to handle type mismatches
        // First try: Both as ObjectIds (matching the schema and how data is stored)
        let catProgress = await this.categoryProgressModel
          .findOne({ userId: userObjectId, categoryId: category._id })
          .exec();

        // Second try: String userId with ObjectId categoryId
        if (!catProgress) {
          catProgress = await this.categoryProgressModel
            .findOne({ userId, categoryId: category._id })
            .exec();
        }

        // Third try: Both as strings (fallback for legacy data)
        if (!catProgress) {
          const categoryIdString = (category._id as any).toString();
          catProgress = await this.categoryProgressModel
            .findOne({ userId, categoryId: categoryIdString })
            .exec();
        }
        const lessons = await this.lessonModel
          .find({ categoryId: category._id, isActive: true })
          .sort({ order: 1 })
          .exec();

        // Count watched videos across all lessons
        let totalVideos = 0;
        let watchedVideos = 0;
        
        for (const lesson of lessons) {
          const lessonVideos = lesson.videos.filter(v => v.isForLesson);
          totalVideos += lessonVideos.length;
          
          // Query lesson progress - try multiple query formats to handle type mismatches
          // First try: Both as ObjectIds (matching the pattern that saves the data in markLessonVideoWatched)
          let lessonProgress = await this.lessonProgressModel
            .findOne({ userId: userObjectId, lessonId: lesson._id })
            .exec();

          // Second try: String userId with ObjectId lessonId
          if (!lessonProgress) {
            lessonProgress = await this.lessonProgressModel
              .findOne({ userId, lessonId: lesson._id })
              .exec();
          }

          // Third try: Both as strings (fallback for legacy data)
          if (!lessonProgress) {
            const lessonIdString = (lesson._id as any).toString();
            lessonProgress = await this.lessonProgressModel
              .findOne({ userId, lessonId: lessonIdString })
              .exec();
          }

          if (lessonProgress) {
            watchedVideos += lessonProgress.watchedVideos.length;
          }
        }

        return {
          ...category.toObject(),
          isUnlocked: catProgress?.unlockedAt
            ? true
            : await this.isCategoryUnlocked(
                userId,
                (category._id as any).toString(),
              ),
          isCompleted: catProgress?.finalQuizPassed || false,
          progress: {
            watchedVideos,
            totalVideos,
            percentage:
              totalVideos > 0
                ? Math.round((watchedVideos / totalVideos) * 100)
                : 0,
          },
        };
      }),
    );

    // Count completed categories
    const completedCategories = categoryProgresses.filter(
      (cat) => cat.isCompleted,
    ).length;
    const totalCategories = categories.length;

    return {
      ...level.toObject(),
      isUnlocked,
      isCompleted: levelProgress?.allCategoriesCompleted || false,
      progress: {
        completedCategories,
        totalCategories,
        percentage:
          totalCategories > 0
            ? Math.round((completedCategories / totalCategories) * 100)
            : 0,
      },
      categories: categoryProgresses,
    };
  }

  /**
   * Get category progress for user
   */
  async getCategoryProgress(userId: string, categoryId: string) {
    // Validate and convert userId to ObjectId
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    const userObjectId = new Types.ObjectId(userId);

    // Validate and convert categoryId to ObjectId
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid categoryId');
    }
    const categoryObjectId = new Types.ObjectId(categoryId);

    const category = await this.categoryModel.findById(categoryObjectId).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Query category progress - try multiple query formats to handle type mismatches
    // First try: Both as strings (matches updateCategoryProgressAfterQuiz pattern that saves the data)
    let categoryProgress = await this.categoryProgressModel
      .findOne({ userId, categoryId })
      .exec();

    // Second try: String userId with ObjectId categoryId (matches getLevelProgress pattern)
    if (!categoryProgress) {
      categoryProgress = await this.categoryProgressModel
        .findOne({ userId, categoryId: categoryObjectId })
        .exec();
    }

    // Third try: Both as ObjectIds (original approach)
    if (!categoryProgress) {
      categoryProgress = await this.categoryProgressModel
        .findOne({ userId: userObjectId, categoryId: categoryObjectId })
        .exec();
    }

    const isUnlocked = categoryProgress?.unlockedAt
      ? true
      : await this.isCategoryUnlocked(userId, categoryId);

    // Get all lessons in category - convert categoryId to ObjectId for query
    const lessons = await this.lessonModel
      .find({ categoryId: categoryObjectId, isActive: true })
      .sort({ order: 1 })
      .exec();

    // Get lesson progresses
    const lessonProgresses = await Promise.all(
      lessons.map(async (lesson) => {
        // Convert lessonId to ObjectId for query
        const lessonObjectId = lesson._id as Types.ObjectId;
        const lessonIdStr = (lesson._id as any).toString();
        
        // Query with explicit ObjectIds
        const query = { 
          userId: userObjectId, 
          lessonId: lessonObjectId 
        };
        
        // Debug: Log the query being made
        console.log(`🔍 Querying progress for lesson ${lessonIdStr}: userId=${userObjectId.toString()}, lessonId=${lessonObjectId.toString()}`);
        
        let lessonProgress = await this.lessonProgressModel
          .findOne(query)
          .exec();
        
        // If not found, try querying with string userId as fallback (in case of schema mismatch)
        if (!lessonProgress) {
          console.log(`   ⚠️ Query with ObjectId failed, trying string userId as fallback...`);
          const fallbackQuery = {
            userId: new Types.ObjectId(userId), // Convert string to ObjectId
            lessonId: lessonObjectId
          };
          lessonProgress = await this.lessonProgressModel
            .findOne(fallbackQuery)
            .exec();
          
          if (lessonProgress) {
            console.log(`   ✅ Found progress using string userId fallback!`);
          }
        }
        
        // Count total videos for this lesson (only the ones for lessons, not quiz)
        const totalVideos = lesson.videos.filter(v => v.isForLesson).length;
        
        // Get watched videos count - ensure we handle the array properly
        let watchedVideosCount = 0;
        let isCompleted = false;
        
        if (lessonProgress) {
          // Get watched videos - ensure we're reading the actual data
          const watchedVideosArray = lessonProgress.watchedVideos || [];
          watchedVideosCount = Array.isArray(watchedVideosArray) ? watchedVideosArray.length : 0;
          
          // Get completion status - explicitly check the boolean value
          isCompleted = Boolean(lessonProgress.allVideosWatched);
          
          // Debug logging for troubleshooting
          console.log(`📊 Lesson ${lessonIdStr} progress found:`);
          console.log(`   - watchedVideos array length: ${watchedVideosArray.length}`);
          console.log(`   - watchedVideos array (first 5): ${JSON.stringify(watchedVideosArray.slice(0, 5))}`);
          console.log(`   - allVideosWatched: ${lessonProgress.allVideosWatched}`);
          console.log(`   - isCompleted: ${isCompleted}`);
          console.log(`   - completedAt: ${lessonProgress.completedAt}`);
          console.log(`   - userId from DB: ${lessonProgress.userId.toString()}`);
          console.log(`   - lessonId from DB: ${lessonProgress.lessonId.toString()}`);
          
          if (watchedVideosCount > 0 || isCompleted) {
            console.log(`✅ Lesson ${lessonIdStr} progress: ${watchedVideosCount}/${totalVideos} watched, completed: ${isCompleted}`);
          }
        } else {
          // Query failed - try to find any progress for this lesson to debug
          const anyProgress = await this.lessonProgressModel
            .find({ lessonId: lessonObjectId })
            .limit(5)
            .exec();
          
          console.log(`⚠️ No progress found for lesson ${lessonIdStr}`);
          console.log(`   - Query used: userId=${userObjectId.toString()}, lessonId=${lessonObjectId.toString()}`);
          console.log(`   - Found ${anyProgress.length} progress records for this lessonId (different users)`);
          if (anyProgress.length > 0) {
            // Handle userId comparison - it might be ObjectId or string
            const queryUserIdStr = userObjectId.toString();
            
            console.log(`   - Query userId: ${queryUserIdStr}`);
            console.log(`   - Found ${anyProgress.length} progress records for this lessonId`);
            
            // Log all userIds found
            const allUserIds = anyProgress.map(p => {
              const pUserId = p.userId;
              return pUserId && typeof pUserId.toString === 'function' ? pUserId.toString() : String(pUserId);
            });
            console.log(`   - All userIds found in DB: ${allUserIds.join(', ')}`);
            
            // Check if the queried userId exists in any of the records
            const matchingProgress = anyProgress.find(p => {
              const pUserId = p.userId;
              const pUserIdStr = pUserId && typeof pUserId.toString === 'function' ? pUserId.toString() : String(pUserId);
              return pUserIdStr === queryUserIdStr;
            });
            
            if (matchingProgress) {
              console.log(`   ⚠️ CRITICAL BUG: Found matching userId in records but query returned null!`);
              console.log(`   ⚠️ This means the MongoDB query is failing even though the data exists.`);
              console.log(`   ⚠️ Matching record ID: ${matchingProgress._id}`);
              console.log(`   ⚠️ Matching record userId type: ${typeof matchingProgress.userId}`);
              console.log(`   ⚠️ Matching record lessonId type: ${typeof matchingProgress.lessonId}`);
              
              // Try a direct query to verify
              const directQuery = await this.lessonProgressModel
                .findById(matchingProgress._id)
                .exec();
              if (directQuery) {
                console.log(`   ⚠️ Direct findById works! userId from direct: ${directQuery.userId}`);
              }
            } else {
              console.log(`   ℹ️ No matching userId found - this is expected (different users)`);
            }
          }
        }

        // Determine if lesson is unlocked
        // Priority: 1. Progress record exists (any progress record means unlocked), 2. Dynamic check via isLessonUnlocked
        let isUnlocked = false;
        if (lessonProgress) {
          // Has progress record - lesson is unlocked (even if unlockedAt is not set, having progress means it was unlocked)
          isUnlocked = true;
        } else {
          // No progress record yet - check dynamically if it should be unlocked
          isUnlocked = await this.isLessonUnlocked(userId, (lesson._id as any).toString());
        }

        return {
          ...lesson.toObject(),
          isUnlocked,
          isCompleted,
          progress: {
            watchedVideos: watchedVideosCount,
            totalVideos,
            percentage: totalVideos > 0 
              ? Math.round((watchedVideosCount / totalVideos) * 100)
              : 0,
          },
        };
      }),
    );

    return {
      ...category.toObject(),
      isUnlocked,
      isCompleted: categoryProgress?.finalQuizPassed || false,
      lessons: lessonProgresses,
    };
  }

  /**
   * Get all levels progress for user
   */
  async getAllLevelsProgress(userId: string) {
    // Validate and convert userId to ObjectId (for fallback queries)
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    const userObjectId = new Types.ObjectId(userId);

    const levels = await this.levelModel
      .find({ isActive: true, deletedAt: null })
      .sort({ order: 1 })
      .exec();

    return Promise.all(
      levels.map(async (level) => {
        const levelProgress = await this.levelProgressModel
          .findOne({ userId, levelId: level._id })
          .exec();
        const isUnlocked = levelProgress?.unlockedAt
          ? true
          : await this.isLevelUnlocked(userId, (level._id as any).toString());

        // Get all categories in level - convert levelId to ObjectId for query
        const levelObjectId = level._id as Types.ObjectId;
        const categories = await this.categoryModel
          .find({ levelId: levelObjectId, isActive: true, deletedAt: null })
          .sort({ order: 1 })
          .exec();

        // Get category progresses with isUnlocked status
        const categoryProgresses = await Promise.all(
          categories.map(async (category) => {
            // Query category progress - try multiple query formats to handle type mismatches
            // First try: Both as strings (matches updateCategoryProgressAfterQuiz pattern that saves the data)
            const categoryIdString = (category._id as any).toString();
            let catProgress = await this.categoryProgressModel
              .findOne({ userId, categoryId: categoryIdString })
              .exec();

            // Second try: String userId with ObjectId categoryId (matches getLevelProgress pattern)
            if (!catProgress) {
              catProgress = await this.categoryProgressModel
                .findOne({ userId, categoryId: category._id })
                .exec();
            }

            // Third try: Both as ObjectIds (original approach)
            if (!catProgress) {
              catProgress = await this.categoryProgressModel
                .findOne({ userId: userObjectId, categoryId: category._id })
                .exec();
            }
            const lessons = await this.lessonModel
              .find({ categoryId: category._id, isActive: true })
              .sort({ order: 1 })
              .exec();

            // Count watched videos across all lessons
            let totalVideos = 0;
            let watchedVideos = 0;
            
            for (const lesson of lessons) {
              const lessonVideos = lesson.videos.filter(v => v.isForLesson);
              totalVideos += lessonVideos.length;
              
              // Query lesson progress - try multiple query formats to handle type mismatches
              // First try: Both as ObjectIds (matching the pattern that saves the data in markLessonVideoWatched)
              let lessonProgress = await this.lessonProgressModel
                .findOne({ userId: userObjectId, lessonId: lesson._id })
                .exec();

              // Second try: String userId with ObjectId lessonId
              if (!lessonProgress) {
                lessonProgress = await this.lessonProgressModel
                  .findOne({ userId, lessonId: lesson._id })
                  .exec();
              }

              // Third try: Both as strings (fallback for legacy data)
              if (!lessonProgress) {
                const lessonIdString = (lesson._id as any).toString();
                lessonProgress = await this.lessonProgressModel
                  .findOne({ userId, lessonId: lessonIdString })
                  .exec();
              }

              if (lessonProgress) {
                watchedVideos += lessonProgress.watchedVideos.length;
              }
            }

            return {
              ...category.toObject(),
              isUnlocked: catProgress?.unlockedAt
                ? true
                : await this.isCategoryUnlocked(
                    userId,
                    (category._id as any).toString(),
                  ),
              isCompleted: catProgress?.finalQuizPassed || false,
              progress: {
                watchedVideos,
                totalVideos,
                percentage:
                  totalVideos > 0
                    ? Math.round((watchedVideos / totalVideos) * 100)
                    : 0,
              },
            };
          }),
        );

        // Count completed categories
        const completedCategories = categoryProgresses.filter(
          (cat) => cat.isCompleted,
        ).length;

        return {
          ...level.toObject(),
          isUnlocked,
          isCompleted: levelProgress?.allCategoriesCompleted || false,
          progress: {
            completedCategories,
            totalCategories: categories.length,
            percentage:
              categories.length > 0
                ? Math.round((completedCategories / categories.length) * 100)
                : 0,
          },
          categories: categoryProgresses,
        };
      }),
    );
  }
}
