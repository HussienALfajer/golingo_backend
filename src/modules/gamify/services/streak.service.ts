/**
 * Streak Service
 * Service for managing user streaks with advanced features
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';
import {
  StreakMaintainedEvent,
  StreakBrokenEvent,
} from '../../../common/events/gamification.events';

@Injectable()
export class StreakService {
  private readonly DAILY_STREAK_RESET_HOURS = 24;
  private readonly WEEKEND_AMULET_DURATION_HOURS = 48;

  constructor(
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Update streak based on activity
   */
  async updateStreak(userId: string): Promise<{
    currentStreak: number;
    bestStreak: number;
    maintained: boolean;
    milestoneReached?: number;
  }> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    const now = new Date();
    const lastActive = stats.lastActiveAt || stats.createdAt || now;

    if (!lastActive) {
      // First activity
      stats.streakCount = 1;
      stats.bestStreak = 1;
      stats.lastActiveAt = now;
      await stats.save();

      return {
        currentStreak: 1,
        bestStreak: 1,
        maintained: true,
      };
    }

    const hoursSinceLastActive =
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);

    // Check if streak should be maintained
    let maintained = false;
    let milestoneReached: number | undefined;

    if (hoursSinceLastActive < this.DAILY_STREAK_RESET_HOURS) {
      // Within 24 hours
      const lastActiveDate = new Date(lastActive);
      const today = new Date(now);
      const isSameDay =
        lastActiveDate.getDate() === today.getDate() &&
        lastActiveDate.getMonth() === today.getMonth() &&
        lastActiveDate.getFullYear() === today.getFullYear();

      if (!isSameDay) {
        // Different day, increment streak
        stats.streakCount += 1;
        maintained = true;

        // Check for best streak
        if (stats.streakCount > (stats.bestStreak || 0)) {
          stats.bestStreak = stats.streakCount;
        }

        // Check for milestones
        if ([7, 30, 100, 365].includes(stats.streakCount)) {
          milestoneReached = stats.streakCount;
        }

        // Emit streak maintained event
        this.eventEmitter.emit('streak.maintained', {
          userId: userId,
          currentStreak: stats.streakCount,
          bestStreak: stats.bestStreak,
        } as StreakMaintainedEvent);
      }
    } else if (
      hoursSinceLastActive >= this.DAILY_STREAK_RESET_HOURS &&
      hoursSinceLastActive < this.DAILY_STREAK_RESET_HOURS * 2
    ) {
      // Between 24-48 hours, check for streak freeze or weekend amulet
      if (stats.streakFreezeActive || stats.weekendAmuletActive) {
        // Streak protected
        maintained = true;
        stats.streakCount += 1;

        if (stats.streakCount > (stats.bestStreak || 0)) {
          stats.bestStreak = stats.streakCount;
        }

        // Consume freeze/amulet
        if (stats.streakFreezeActive) {
          stats.streakFreezeActive = false;
          stats.streakFreezeExpiresAt = undefined;
        }
      } else {
        // Streak broken
        const previousStreak = stats.streakCount;
        stats.streakCount = 1;

        // Emit streak broken event
        this.eventEmitter.emit('streak.broken', {
          userId: userId,
          previousStreak: previousStreak,
        } as StreakBrokenEvent);
      }
    } else {
      // More than 48 hours, reset streak (unless weekend amulet active)
      if (!stats.weekendAmuletActive) {
        const previousStreak = stats.streakCount;
        stats.streakCount = 1;

        // Emit streak broken event
        this.eventEmitter.emit('streak.broken', {
          userId: userId,
          previousStreak: previousStreak,
        } as StreakBrokenEvent);
      } else {
        // Weekend amulet protects streak
        maintained = true;
        stats.streakCount += 1;
        stats.weekendAmuletActive = false;
      }
    }

    stats.lastActiveAt = now;
    await stats.save();

    return {
      currentStreak: stats.streakCount,
      bestStreak: stats.bestStreak || stats.streakCount,
      maintained,
      milestoneReached,
    };
  }

  /**
   * Activate streak freeze
   */
  async activateStreakFreeze(
    userId: string,
    durationHours: number = 24,
  ): Promise<void> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    stats.streakFreezeActive = true;
    stats.streakFreezeExpiresAt = expiresAt;
    stats.streakFreezesUsed += 1;

    await stats.save();
  }

  /**
   * Activate weekend amulet
   */
  async activateWeekendAmulet(userId: string): Promise<void> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    stats.weekendAmuletActive = true;

    await stats.save();
  }

  /**
   * Repair streak (after using streak freeze or gem purchase)
   */
  async repairStreak(userId: string): Promise<void> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    // Only repair if streak was recently broken
    const now = new Date();
    const lastActive = stats.lastActiveAt || stats.createdAt;
    if (!lastActive) return;

    const hoursSinceLastActive =
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);

    // Repair if streak broken within last 48 hours
    if (
      hoursSinceLastActive >= this.DAILY_STREAK_RESET_HOURS &&
      hoursSinceLastActive < this.DAILY_STREAK_RESET_HOURS * 2 &&
      stats.streakCount === 1
    ) {
      // Restore previous streak (approximation)
      stats.streakCount = Math.max(2, (stats.bestStreak || 1));
      stats.lastActiveAt = now;
      await stats.save();

      // Emit streak maintained event
      this.eventEmitter.emit('streak.maintained', {
        userId: userId,
        currentStreak: stats.streakCount,
        bestStreak: stats.bestStreak || stats.streakCount,
      } as StreakMaintainedEvent);
    }
  }

  /**
   * Get streak information
   */
  async getStreakInfo(userId: string): Promise<{
    currentStreak: number;
    bestStreak: number;
    streakFreezeActive: boolean;
    weekendAmuletActive: boolean;
    nextMilestone?: number;
  }> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    const milestones = [7, 30, 100, 365];
    const nextMilestone = milestones.find((m) => m > (stats.streakCount || 0));

    return {
      currentStreak: stats.streakCount || 0,
      bestStreak: stats.bestStreak || stats.streakCount || 0,
      streakFreezeActive: stats.streakFreezeActive || false,
      weekendAmuletActive: stats.weekendAmuletActive || false,
      nextMilestone,
    };
  }
}

