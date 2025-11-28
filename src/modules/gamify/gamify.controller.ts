/**
 * Gamify Controller
 * Controller for gamification endpoints
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GamifyService } from './gamify.service';
import { ApplySessionDto } from './dto/apply-session.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AchievementsService } from '../achievements/achievements.service';
import { ProgressService } from '../progress/progress.service';
import { QuizzesService } from '../quizzes/quizzes.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CategoryProgress,
  CategoryProgressDocument,
} from '../progress/schemas/category-progress.schema';

@ApiTags('Gamification')
@Controller('me/gamify')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GamifyController {
  constructor(
    private readonly gamifyService: GamifyService,
    private readonly achievementsService: AchievementsService,
    private readonly progressService: ProgressService,
    private readonly quizzesService: QuizzesService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get user gamification stats' })
  @ApiResponse({
    status: 200,
    description: 'User stats retrieved successfully',
  })
  async getStats(@CurrentUser() user: UserDocument) {
    const stats = await this.gamifyService.getUserStats(
      (user._id as any).toString(),
    );
    return {
      xp: stats.xp,
      energy: stats.energy,
      gems: stats.gems,
      streakCount: stats.streakCount,
      lastActiveAt: stats.lastActiveAt,
      totalCorrect: stats.totalCorrect,
      totalSessions: stats.totalSessions,
    };
  }

  @Post('apply-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply a learning/quiz session to gamification stats',
  })
  @ApiResponse({ status: 200, description: 'Session applied successfully' })
  async applySession(
    @Body() applySessionDto: ApplySessionDto,
    @CurrentUser() user: UserDocument,
  ) {
    const result = await this.gamifyService.applySession(
      (user._id as any).toString(),
      applySessionDto,
    );
    return {
      stats: {
        xp: result.stats.xp,
        energy: result.stats.energy,
        gems: result.stats.gems,
        streakCount: result.streakCount,
        totalCorrect: result.stats.totalCorrect,
        totalSessions: result.stats.totalSessions,
      },
      xpGained: result.xpGained,
      energyDelta: result.energyDelta,
      streakCount: result.streakCount,
      achievementsUnlocked: result.achievementsUnlocked.map((ach) => ({
        achievementId: ach.achievementId,
        unlockedAt: ach.unlockedAt,
        metadata: ach.metadata,
      })),
      gemsGained: result.gemsGained,
    };
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Get user achievements' })
  @ApiResponse({
    status: 200,
    description: 'User achievements retrieved successfully',
  })
  async getAchievements(@CurrentUser() user: UserDocument) {
    const achievements = await this.achievementsService.getUserAchievements(
      (user._id as any).toString(),
    );
    return achievements.map((ach) => ({
      achievementId: ach.achievementId,
      unlockedAt: ach.unlockedAt,
      metadata: ach.metadata,
    }));
  }

  @Post('achievements/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually check and unlock achievements for user' })
  @ApiResponse({ status: 200, description: 'Achievements checked' })
  async checkAchievements(@CurrentUser() user: UserDocument) {
    // This endpoint can be used to manually trigger achievement checks
    // In practice, achievements are checked automatically in applySession
    const stats = await this.gamifyService.getUserStats(
      (user._id as any).toString(),
    );
    // Re-check achievements based on current stats
    const sessionData: ApplySessionDto = {
      correct: stats.totalCorrect,
      total: stats.totalSessions * 10, // Estimate
      passed: true,
    };
    const result = await this.gamifyService.applySession(
      (user._id as any).toString(),
      sessionData,
    );
    return {
      achievementsUnlocked: result.achievementsUnlocked.map((ach) => ({
        achievementId: ach.achievementId,
        unlockedAt: ach.unlockedAt,
        metadata: ach.metadata,
      })),
    };
  }
}

/**
 * Path Controller
 * Controller for learning path endpoints (optional)
 */
@ApiTags('Path')
@Controller('me/path')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PathController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly quizzesService: QuizzesService,
    @InjectModel(CategoryProgress.name)
    private categoryProgressModel: Model<CategoryProgressDocument>,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get learning path with node states (locked/current/completed/perfect)',
  })
  @ApiResponse({
    status: 200,
    description: 'Learning path retrieved successfully',
  })
  async getPath(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    // Convert userId to ObjectId for fallback queries
    const userObjectId = new Types.ObjectId(userId);
    
    const levelsProgress =
      await this.progressService.getAllLevelsProgress(userId);

    // Transform to path format with states
    const path = await Promise.all(
      levelsProgress.map(async (level: any) => {
        // Get level progress to get categories
        const levelProgress = await this.progressService.getLevelProgress(
          userId,
          level._id.toString(),
        );
        const categories = await Promise.all(
          (levelProgress.categories || []).map(async (category: any) => {
            // Get category progress to check finalQuizBestScore
            // Query with fallback pattern to handle type mismatches
            // Ensure categoryId is properly converted for queries
            const categoryIdString = (category._id as any).toString();
            const categoryObjectId = Types.ObjectId.isValid(categoryIdString) 
              ? new Types.ObjectId(categoryIdString) 
              : category._id;
            
            // Match the query order used in getAllLevelsProgress and getLevelProgress
            // First try: Both as strings (matches updateCategoryProgressAfterQuiz pattern that saves the data)
            let categoryProgress = await this.categoryProgressModel
              .findOne({ userId, categoryId: categoryIdString })
              .exec();

            // Second try: String userId with ObjectId categoryId
            if (!categoryProgress) {
              categoryProgress = await this.categoryProgressModel
                .findOne({ userId, categoryId: categoryObjectId })
                .exec();
            }

            // Third try: Both as ObjectIds (fallback for schema-consistent data)
            if (!categoryProgress) {
              categoryProgress = await this.categoryProgressModel
                .findOne({ userId: userObjectId, categoryId: categoryObjectId })
                .exec();
            }
            
            // Fourth try: ObjectId userId with string categoryId (additional fallback)
            if (!categoryProgress) {
              categoryProgress = await this.categoryProgressModel
                .findOne({ userId: userObjectId, categoryId: categoryIdString })
                .exec();
            }

            // Determine category state
            // Use categoryProgress as primary source of truth (from database)
            // Check multiple indicators: finalQuizPassed, completedAt, and fallback to category.isCompleted
            const isCompleted = 
              categoryProgress?.finalQuizPassed === true || 
              (categoryProgress?.completedAt != null) ||
              category.isCompleted === true;
            
            let state = 'locked';
            if (isCompleted) {
              // Check if perfect (100% score on quiz)
              // Use categoryProgress score if available, otherwise assume completed
              const bestScore = categoryProgress?.finalQuizBestScore;
              if (bestScore === 100) {
                state = 'perfect';
              } else {
                state = 'completed';
              }
            } else if (category.isUnlocked) {
              state = 'current';
            }

            return {
              id: category._id,
              levelId: category.levelId,
              code: category.code,
              title: category.title,
              description: category.description,
              order: category.order,
              state,
              progress: category.progress,
            };
          }),
        );

        return {
          id: level._id,
          code: level.code,
          title: level.title,
          description: level.description,
          order: level.order,
          isUnlocked: level.isUnlocked,
          isCompleted: level.isCompleted,
          progress: level.progress,
          categories,
        };
      }),
    );

    return {
      path,
      userProgress: {
        totalLevels: path.length,
        completedLevels: path.filter((l) => l.isCompleted).length,
        totalCategories: path.reduce((sum, l) => sum + l.categories.length, 0),
        completedCategories: path.reduce(
          (sum, l) =>
            sum +
            l.categories.filter(
              (c: any) => c.state === 'completed' || c.state === 'perfect',
            ).length,
          0,
        ),
      },
    };
  }
}
