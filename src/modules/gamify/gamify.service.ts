/**
 * Gamify Service
 * Service for managing gamification features (XP, energy, streak, gems, achievements)
 * Now integrates with LeagueService, StreakService, HeartsService, QuestService, and MasteryService
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserStats, UserStatsDocument } from './schemas/user-stats.schema';
import { ApplySessionDto } from './dto/apply-session.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { UserAchievementDocument } from '../achievements/schemas/user-achievement.schema';
import { LeagueService } from './services/league.service';
import { StreakService } from './services/streak.service';
import { HeartsService } from './services/hearts.service';
import { QuestService } from './services/quest.service';
import { MasteryService } from './services/mastery.service';
import { XPGainedEvent, LessonCompletedEvent } from '../../common/events/gamification.events';

@Injectable()
export class GamifyService {
  private readonly MAX_ENERGY = 25;
  private readonly ENERGY_REGENERATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes per energy

  constructor(
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private readonly achievementsService: AchievementsService,
    private readonly leagueService: LeagueService,
    private readonly streakService: StreakService,
    private readonly heartsService: HeartsService,
    private readonly questService: QuestService,
    private readonly masteryService: MasteryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get or create user stats
   */
  async getOrCreateUserStats(userId: string): Promise<UserStatsDocument> {
    const userObjectId = new Types.ObjectId(userId);
    
    // Use findOneAndUpdate with upsert to handle race conditions atomically
    // This ensures only one document is created even if multiple requests happen simultaneously
    let stats: UserStatsDocument | null = await this.userStatsModel
      .findOneAndUpdate(
        { userId: userObjectId },
        {
          $setOnInsert: {
            userId: userObjectId,
            xp: 0,
            energy: this.MAX_ENERGY,
            gems: 0,
            streakCount: 0,
            bestStreak: 0,
            totalCorrect: 0,
            totalSessions: 0,
            heartsRemaining: 5,
            weeklyXP: 0,
            allTimeXP: 0,
            dailyGoalXP: 50,
            dailyGoalProgress: 0,
            currentLeague: 'bronze',
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    // If stats still doesn't exist (edge case), try one more time with find
    if (!stats) {
      stats = await this.userStatsModel
        .findOne({ userId: userObjectId })
        .exec();
    }

    // Ensure stats exists - findOneAndUpdate with upsert should always return a document
    if (!stats) {
      throw new Error(`Failed to create or retrieve user stats for userId: ${userId}`);
    }

    // At this point, stats is guaranteed to be non-null
    const userStats: UserStatsDocument = stats;

    // Assign to league if needed (league is already set to 'bronze' in upsert for new users)
    // getOrAssignLeague is idempotent, so it's safe to call
    this.leagueService.getOrAssignLeague(userId).catch((err) => {
      // Log but don't throw - league assignment is not critical
      console.error('Error assigning league (non-critical):', err);
    });

    // Regenerate energy and hearts if needed
    await this.regenerateEnergy(userStats);
    await this.heartsService.regenerateHearts(userStats);

    return userStats;
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string): Promise<UserStatsDocument> {
    return this.getOrCreateUserStats(userId);
  }

  /**
   * Regenerate energy based on time elapsed - uses atomic operation to prevent race conditions
   */
  private async regenerateEnergy(stats: UserStatsDocument): Promise<void> {
    if (stats.energy >= this.MAX_ENERGY) {
      return;
    }

    const now = new Date();
    const lastActive =
      stats.lastActiveAt || stats.updatedAt || stats.createdAt || now;
    const timeElapsed = now.getTime() - lastActive.getTime();
    const energyToRegenerate = Math.floor(
      timeElapsed / this.ENERGY_REGENERATION_INTERVAL_MS,
    );

    if (energyToRegenerate > 0) {
      // Use atomic update to prevent race conditions
      // Only update if lastActiveAt matches what we expect (optimistic locking)
      const result = await this.userStatsModel.findOneAndUpdate(
        {
          _id: stats._id,
          energy: { $lt: this.MAX_ENERGY },
          // Ensure we're updating based on the same lastActive time we calculated from
          $or: [
            { lastActiveAt: lastActive },
            { lastActiveAt: { $exists: false } },
          ],
        },
        {
          $set: { lastActiveAt: now },
          $min: { energy: this.MAX_ENERGY }, // Cap at max
          $inc: { energy: energyToRegenerate },
        },
        { new: true },
      ).exec();

      // If atomic update succeeded, update local stats object
      if (result) {
        // Ensure energy doesn't exceed max (MongoDB $inc + $min may need manual capping)
        if (result.energy > this.MAX_ENERGY) {
          await this.userStatsModel.updateOne(
            { _id: stats._id },
            { $set: { energy: this.MAX_ENERGY } },
          ).exec();
          result.energy = this.MAX_ENERGY;
        }
        stats.energy = result.energy;
        stats.lastActiveAt = result.lastActiveAt;
      }
    }
  }

  /**
   * Calculate XP based on session results with boost multiplier
   */
  private calculateXP(
    correct: number,
    passed: boolean,
    streakCount: number,
    stats?: UserStatsDocument,
  ): number {
    // Base XP: 10 per correct answer
    let xp = correct * 10;

    // Bonus for passing: +20
    if (passed) {
      xp += 20;
    }

    // Streak bonus: +5 per streak day (capped at 50)
    const streakBonus = Math.min(streakCount * 5, 50);
    xp += streakBonus;

    // Apply XP boost multiplier if active
    if (stats) {
      const boostMultiplier = this.getActiveXPBoostMultiplier(stats);
      if (boostMultiplier > 1) {
        xp = Math.floor(xp * boostMultiplier);
      }
    }

    return xp;
  }

  /**
   * Get active XP boost multiplier (returns 1 if no active boost)
   */
  private getActiveXPBoostMultiplier(stats: UserStatsDocument): number {
    if (!stats.xpBoostExpiresAt || !stats.xpBoostMultiplier) {
      return 1;
    }

    // Check if boost is still active
    if (new Date() < new Date(stats.xpBoostExpiresAt)) {
      return stats.xpBoostMultiplier;
    }

    return 1;
  }

  /**
   * Get time remaining on XP boost (in seconds)
   */
  getXPBoostTimeRemaining(stats: UserStatsDocument): number {
    if (!stats.xpBoostExpiresAt) {
      return 0;
    }

    const remaining = new Date(stats.xpBoostExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Calculate energy delta (decrement for wrong answers)
   */
  private calculateEnergyDelta(correct: number, total: number): number {
    const wrong = total - correct;
    // Decrement 1 energy per wrong answer, but don't go below 0
    return -wrong;
  }

  /**
   * Update streak using StreakService
   */
  private async updateStreak(userId: string): Promise<number> {
    const streakResult = await this.streakService.updateStreak(userId);
    return streakResult.currentStreak;
  }

  /**
   * Check and unlock achievements based on stats
   */
  private async checkAchievements(
    userId: string,
    stats: UserStatsDocument,
    sessionData: ApplySessionDto,
  ): Promise<UserAchievementDocument[]> {
    const unlocked: UserAchievementDocument[] = [];

    // Check streak achievements
    if (stats.streakCount >= 3) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'STREAK_3_DAYS',
          { streakCount: stats.streakCount },
        );
      if (achievement) unlocked.push(achievement);
    }
    if (stats.streakCount >= 7) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'STREAK_7_DAYS',
          { streakCount: stats.streakCount },
        );
      if (achievement) unlocked.push(achievement);
    }
    if (stats.streakCount >= 14) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'STREAK_14_DAYS',
          { streakCount: stats.streakCount },
        );
      if (achievement) unlocked.push(achievement);
    }
    if (stats.streakCount >= 30) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'STREAK_30_DAYS',
          { streakCount: stats.streakCount },
        );
      if (achievement) unlocked.push(achievement);
    }

    // Check total correct achievements
    if (stats.totalCorrect >= 100) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'TOTAL_CORRECT_100',
          { totalCorrect: stats.totalCorrect },
        );
      if (achievement) unlocked.push(achievement);
    }
    if (stats.totalCorrect >= 300) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'TOTAL_CORRECT_300',
          { totalCorrect: stats.totalCorrect },
        );
      if (achievement) unlocked.push(achievement);
    }
    if (stats.totalCorrect >= 600) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'TOTAL_CORRECT_600',
          { totalCorrect: stats.totalCorrect },
        );
      if (achievement) unlocked.push(achievement);
    }

    // Check first quiz pass
    if (sessionData.passed && stats.totalSessions === 1) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'FIRST_QUIZ_PASS',
          { quizId: sessionData.quizId },
        );
      if (achievement) unlocked.push(achievement);
    }

    // Check perfect category (all correct in a session)
    if (sessionData.passed && sessionData.correct === sessionData.total) {
      const achievement =
        await this.achievementsService.checkAndUnlockAchievement(
          userId,
          'PERFECT_CATEGORY',
          {
            categoryId: sessionData.categoryId,
            correct: sessionData.correct,
            total: sessionData.total,
          },
        );
      if (achievement) unlocked.push(achievement);
    }

    return unlocked;
  }

  /**
   * Award gems for milestones
   */
  private calculateGemsGained(
    stats: UserStatsDocument,
    xpGained: number,
  ): number {
    // Award gems based on XP milestones (1 gem per 100 XP)
    const newTotalXP = stats.xp + xpGained;
    const oldMilestone = Math.floor(stats.xp / 100);
    const newMilestone = Math.floor(newTotalXP / 100);
    return Math.max(0, newMilestone - oldMilestone);
  }

  /**
   * Apply a learning/quiz session to user stats
   * Now integrates with all gamification services
   */
  async applySession(
    userId: string,
    sessionData: ApplySessionDto,
  ): Promise<{
    stats: UserStatsDocument;
    xpGained: number;
    energyDelta: number;
    streakCount: number;
    achievementsUnlocked: UserAchievementDocument[];
    gemsGained: number;
    heartsLost?: number;
    questsCompleted?: number;
    masteryLeveledUp?: boolean;
  }> {
    const stats = await this.getOrCreateUserStats(userId);

    // Check if user can continue (has hearts)
    const canContinue = await this.heartsService.canContinue(userId);
    if (!canContinue) {
      throw new BadRequestException('Not enough hearts. Practice to earn more hearts.');
    }

    // Calculate XP
    const xpGained = this.calculateXP(
      sessionData.correct,
      sessionData.passed,
      stats.streakCount,
    );

    // Calculate energy delta
    const energyDelta = this.calculateEnergyDelta(
      sessionData.correct,
      sessionData.total,
    );

    // Lose hearts for wrong answers
    const wrongAnswers = sessionData.total - sessionData.correct;
    let heartsLost = 0;
    for (let i = 0; i < wrongAnswers; i++) {
      const result = await this.heartsService.loseHeart(userId, 'wrong_answer');
      if (!result.canContinue && i < wrongAnswers - 1) {
        // Out of hearts
        break;
      }
      heartsLost += 1;
    }

    // Update stats
    stats.xp += xpGained;
    stats.allTimeXP = (stats.allTimeXP || 0) + xpGained;
    stats.energy = Math.max(0, stats.energy + energyDelta);
    stats.totalCorrect += sessionData.correct;
    stats.totalSessions += 1;
    stats.dailyGoalProgress = (stats.dailyGoalProgress || 0) + xpGained;

    // Update streak
    const newStreakCount = await this.updateStreak(userId);

    // Update weekly XP for league
    await this.leagueService.updateUserWeeklyXP(userId, xpGained);

    // Update skill mastery if categoryId is provided
    let masteryLeveledUp = false;
    if (sessionData.categoryId) {
      const masteryResult = await this.masteryService.addSkillXP(
        userId,
        sessionData.categoryId,
        xpGained,
        wrongAnswers,
        false, // isPractice
      );
      masteryLeveledUp = masteryResult.leveledUp;
    }

    // Calculate gems gained
    const gemsGained = this.calculateGemsGained(stats, xpGained);
    stats.gems += gemsGained;

    await stats.save();

    // Emit XP gained event
    this.eventEmitter.emit('xp.gained', {
      userId,
      xpAmount: xpGained,
      source: 'lesson',
      metadata: { ...sessionData },
    } as XPGainedEvent);

    // Update quest progress
    await this.questService.handleXPGained(userId, xpGained);
    if (sessionData.passed) {
      await this.questService.handleLessonCompleted(userId);
    }

    // Check achievements
    const achievementsUnlocked = await this.checkAchievements(
      userId,
      stats,
      sessionData,
    );

    // Check daily goal
    if (stats.dailyGoalProgress >= (stats.dailyGoalXP || 50)) {
      // Daily goal reached
      this.eventEmitter.emit('daily.goal_reached', {
        userId,
        dailyGoalXP: stats.dailyGoalXP || 50,
        reward: 10, // Gem reward
      });
    }

    return {
      stats,
      xpGained,
      energyDelta,
      streakCount: newStreakCount,
      achievementsUnlocked,
      gemsGained,
      heartsLost,
      questsCompleted: 0, // Will be updated by quest service
      masteryLeveledUp,
    };
  }

  /**
   * Use streak freeze (called by shop service after purchase)
   */
  async useStreakFreeze(userId: string, durationHours: number = 24): Promise<void> {
    await this.streakService.activateStreakFreeze(userId, durationHours);
  }

  /**
   * Refill energy (called by shop service after purchase)
   */
  async refillEnergy(
    userId: string,
    amount: number = this.MAX_ENERGY,
  ): Promise<void> {
    const stats = await this.getOrCreateUserStats(userId);
    stats.energy = Math.min(this.MAX_ENERGY, stats.energy + amount);
    await stats.save();
  }

  /**
   * Refill hearts (called by shop service after purchase)
   */
  async refillHearts(userId: string, amount: number = 5): Promise<void> {
    await this.heartsService.refillHearts(userId, amount);
  }

  /**
   * Apply XP boost (called by shop service after purchase)
   * Sets the boost multiplier and expiration time
   */
  async applyXPBoost(
    userId: string,
    multiplier: number,
    durationMinutes: number,
  ): Promise<{ expiresAt: Date; multiplier: number }> {
    const stats = await this.getOrCreateUserStats(userId);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // If there's an existing boost, extend it or use the higher multiplier
    if (stats.xpBoostExpiresAt && new Date(stats.xpBoostExpiresAt) > new Date()) {
      // Boost is still active - stack duration and use higher multiplier
      const currentRemaining =
        new Date(stats.xpBoostExpiresAt).getTime() - Date.now();
      const newExpiration = new Date(
        Date.now() + currentRemaining + durationMinutes * 60 * 1000,
      );
      stats.xpBoostExpiresAt = newExpiration;
      stats.xpBoostMultiplier = Math.max(
        stats.xpBoostMultiplier || 1,
        multiplier,
      );
    } else {
      // No active boost - set new one
      stats.xpBoostMultiplier = multiplier;
      stats.xpBoostExpiresAt = expiresAt;
    }

    await stats.save();

    return {
      expiresAt: stats.xpBoostExpiresAt,
      multiplier: stats.xpBoostMultiplier,
    };
  }

  /**
   * Get user's active boost info
   */
  async getActiveBoost(
    userId: string,
  ): Promise<{ active: boolean; multiplier: number; expiresAt?: Date; secondsRemaining: number }> {
    const stats = await this.getOrCreateUserStats(userId);
    const multiplier = this.getActiveXPBoostMultiplier(stats);
    const secondsRemaining = this.getXPBoostTimeRemaining(stats);

    return {
      active: multiplier > 1,
      multiplier,
      expiresAt: stats.xpBoostExpiresAt,
      secondsRemaining,
    };
  }
}
