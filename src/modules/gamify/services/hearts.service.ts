/**
 * Hearts Service
 * Service for managing hearts/lives system
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';
import {
  HeartLostEvent,
  HeartGainedEvent,
} from '../../../common/events/gamification.events';

@Injectable()
export class HeartsService {
  private readonly MAX_HEARTS = 5;
  private readonly HEART_REGENERATION_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours
  private readonly PRACTICE_HEART_DURATION_MINUTES = 15; // Practice for 15 min to earn 1 heart

  constructor(
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get or create user stats with hearts
   * Uses atomic upsert to handle race conditions
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
            heartsRemaining: this.MAX_HEARTS,
            xp: 0,
            energy: 25,
            gems: 0,
            streakCount: 0,
            totalCorrect: 0,
            totalSessions: 0,
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

    // Regenerate hearts if needed
    await this.regenerateHearts(userStats);

    return userStats;
  }

  /**
   * Regenerate hearts based on time elapsed
   */
  async regenerateHearts(stats: UserStatsDocument): Promise<void> {
    if (stats.heartsRemaining >= this.MAX_HEARTS) {
      return;
    }

    const now = new Date();
    const lastHeartLost = stats.lastHeartLostAt || stats.updatedAt || stats.createdAt || now;
    const timeElapsed = now.getTime() - lastHeartLost.getTime();
    const heartsToRegenerate = Math.floor(
      timeElapsed / this.HEART_REGENERATION_INTERVAL_MS,
    );

    if (heartsToRegenerate > 0) {
      const oldHearts = stats.heartsRemaining;
      stats.heartsRemaining = Math.min(
        this.MAX_HEARTS,
        stats.heartsRemaining + heartsToRegenerate,
      );

      // Update lastHeartLostAt if hearts are full
      if (stats.heartsRemaining >= this.MAX_HEARTS) {
        stats.lastHeartLostAt = undefined;
      } else {
        // Update to account for regenerated hearts
        const remainingTime = timeElapsed % this.HEART_REGENERATION_INTERVAL_MS;
        stats.lastHeartLostAt = new Date(
          now.getTime() - remainingTime,
        );
      }

      await stats.save();

      // Emit heart gained event
      if (oldHearts < stats.heartsRemaining) {
        this.eventEmitter.emit('heart.gained', {
          userId: stats.userId.toString(),
          heartsRemaining: stats.heartsRemaining,
          source: 'regeneration',
        } as HeartGainedEvent);
      }
    }
  }

  /**
   * Lose a heart (on wrong answer)
   */
  async loseHeart(userId: string, reason: string = 'wrong_answer'): Promise<{
    heartsRemaining: number;
    canContinue: boolean;
  }> {
    const stats = await this.getOrCreateUserStats(userId);

    // Don't lose hearts if unlimited (premium feature - check here if needed)
    // For now, we'll always lose hearts

    if (stats.heartsRemaining > 0) {
      stats.heartsRemaining -= 1;
      stats.lastHeartLostAt = new Date();
      await stats.save();

      // Emit heart lost event
      this.eventEmitter.emit('heart.lost', {
        userId: userId,
        heartsRemaining: stats.heartsRemaining,
        reason: reason,
      } as HeartLostEvent);
    }

    return {
      heartsRemaining: stats.heartsRemaining,
      canContinue: stats.heartsRemaining > 0,
    };
  }

  /**
   * Gain a heart through practice
   */
  async gainHeartFromPractice(userId: string): Promise<void> {
    const stats = await this.getOrCreateUserStats(userId);

    if (stats.heartsRemaining < this.MAX_HEARTS) {
      stats.heartsRemaining += 1;
      stats.practiceHeartsEarned = (stats.practiceHeartsEarned || 0) + 1;
      await stats.save();

      // Emit heart gained event
      this.eventEmitter.emit('heart.gained', {
        userId: userId,
        heartsRemaining: stats.heartsRemaining,
        source: 'practice',
      } as HeartGainedEvent);
    }
  }

  /**
   * Refill hearts (purchased or rewarded)
   */
  async refillHearts(userId: string, amount: number = this.MAX_HEARTS): Promise<void> {
    const stats = await this.getOrCreateUserStats(userId);

    const oldHearts = stats.heartsRemaining;
    stats.heartsRemaining = Math.min(
      this.MAX_HEARTS,
      stats.heartsRemaining + amount,
    );

    if (stats.heartsRemaining >= this.MAX_HEARTS) {
      stats.lastHeartLostAt = undefined;
    }

    await stats.save();

    // Emit heart gained event
    if (oldHearts < stats.heartsRemaining) {
      this.eventEmitter.emit('heart.gained', {
        userId: userId,
        heartsRemaining: stats.heartsRemaining,
        source: 'purchase',
      } as HeartGainedEvent);
    }
  }

  /**
   * Check if user can continue (has hearts)
   */
  async canContinue(userId: string): Promise<boolean> {
    const stats = await this.getOrCreateUserStats(userId);
    return stats.heartsRemaining > 0;
  }

  /**
   * Get hearts status
   */
  async getHeartsStatus(userId: string): Promise<{
    heartsRemaining: number;
    maxHearts: number;
    timeUntilNextRegeneration?: number; // milliseconds
    canPracticeForHeart: boolean;
  }> {
    const stats = await this.getOrCreateUserStats(userId);

    let timeUntilNextRegeneration: number | undefined;
    if (stats.heartsRemaining < this.MAX_HEARTS && stats.lastHeartLostAt) {
      const now = new Date();
      const timeSinceLastLost = now.getTime() - stats.lastHeartLostAt.getTime();
      const timeUntilNext = this.HEART_REGENERATION_INTERVAL_MS - timeSinceLastLost;
      timeUntilNextRegeneration = Math.max(0, timeUntilNext);
    }

    return {
      heartsRemaining: stats.heartsRemaining,
      maxHearts: this.MAX_HEARTS,
      timeUntilNextRegeneration,
      canPracticeForHeart: stats.heartsRemaining < this.MAX_HEARTS,
    };
  }
}

