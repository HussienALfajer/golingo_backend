/**
 * Milestone Service
 * Service for managing streak milestones and rewards
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StreakMilestone,
  StreakMilestoneDocument,
  MilestoneReward,
} from '../schemas/streak-milestone.schema';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';

export interface MilestoneClaimResult {
  milestone: StreakMilestoneDocument;
  reward: MilestoneReward;
  gemsAwarded: number;
  xpBoostApplied: boolean;
  streakFreezeAwarded: boolean;
}

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  constructor(
    @InjectModel(StreakMilestone.name)
    private milestoneModel: Model<StreakMilestoneDocument>,
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
  ) {}

  /**
   * Initialize default streak milestones
   */
  async initializeDefaultMilestones(): Promise<void> {
    const defaultMilestones = [
      {
        day: 3,
        title: '3-Day Streak!',
        description: 'You practiced for 3 days in a row!',
        celebrationMessage: 'Great start! Keep the momentum going!',
        icon: '🔥',
        reward: { gems: 5 },
      },
      {
        day: 7,
        title: 'Week Warrior!',
        description: 'A full week of practice!',
        celebrationMessage: 'One week down! You are building a great habit!',
        icon: '⭐',
        reward: { gems: 15, xpBoostMultiplier: 1.5, xpBoostDurationMinutes: 30 },
      },
      {
        day: 14,
        title: 'Two Week Champion!',
        description: '14 days of consistent practice!',
        celebrationMessage: 'Two weeks of dedication! Amazing progress!',
        icon: '🏆',
        reward: { gems: 30, streakFreeze: true },
      },
      {
        day: 30,
        title: 'Monthly Master!',
        description: 'A full month of learning!',
        celebrationMessage: 'One month! You are truly committed to learning!',
        icon: '🎯',
        reward: {
          gems: 50,
          xpBoostMultiplier: 2,
          xpBoostDurationMinutes: 60,
          specialBadge: 'monthly_master',
        },
      },
      {
        day: 60,
        title: 'Two Month Legend!',
        description: '60 days of dedication!',
        celebrationMessage:
          'Two months of consistent practice! You are a legend!',
        icon: '💎',
        reward: { gems: 100, streakFreeze: true },
      },
      {
        day: 90,
        title: 'Quarter Year Hero!',
        description: '90 days - three months of learning!',
        celebrationMessage:
          'Three months! Your dedication is truly inspiring!',
        icon: '🏅',
        reward: {
          gems: 150,
          xpBoostMultiplier: 2,
          xpBoostDurationMinutes: 120,
          specialBadge: 'quarter_hero',
        },
      },
      {
        day: 180,
        title: 'Half Year Champion!',
        description: 'Six months of incredible dedication!',
        celebrationMessage:
          'Half a year! You have shown extraordinary commitment!',
        icon: '👑',
        reward: {
          gems: 300,
          streakFreeze: true,
          specialBadge: 'half_year_champion',
        },
      },
      {
        day: 365,
        title: 'Year-Long Legend!',
        description: 'A full year of daily practice!',
        celebrationMessage:
          'ONE YEAR! You are an absolute legend! This achievement is incredibly rare!',
        icon: '🌟',
        reward: {
          gems: 500,
          xpBoostMultiplier: 3,
          xpBoostDurationMinutes: 180,
          streakFreeze: true,
          specialBadge: 'year_legend',
        },
      },
    ];

    for (const milestone of defaultMilestones) {
      await this.milestoneModel
        .findOneAndUpdate({ day: milestone.day }, milestone, { upsert: true })
        .exec();
    }

    this.logger.log('Default streak milestones initialized');
  }

  /**
   * Get all active milestones
   */
  async getAllMilestones(): Promise<StreakMilestoneDocument[]> {
    return this.milestoneModel
      .find({ isActive: true })
      .sort({ day: 1 })
      .exec();
  }

  /**
   * Get milestones available for user to claim
   */
  async getClaimableMilestones(
    userId: string,
  ): Promise<StreakMilestoneDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const stats = await this.userStatsModel
      .findOne({ userId: userObjectId })
      .exec();

    if (!stats) {
      return [];
    }

    const claimedDays = stats.claimedStreakMilestones || [];
    const currentStreak = stats.streakCount;

    // Get milestones that:
    // 1. User's streak has reached
    // 2. Haven't been claimed yet
    return this.milestoneModel
      .find({
        isActive: true,
        day: { $lte: currentStreak, $nin: claimedDays },
      })
      .sort({ day: 1 })
      .exec();
  }

  /**
   * Get user's milestone progress
   */
  async getMilestoneProgress(userId: string): Promise<{
    currentStreak: number;
    nextMilestone: StreakMilestoneDocument | null;
    claimedMilestones: number[];
    claimableMilestones: StreakMilestoneDocument[];
  }> {
    const userObjectId = new Types.ObjectId(userId);
    const stats = await this.userStatsModel
      .findOne({ userId: userObjectId })
      .exec();

    const currentStreak = stats?.streakCount || 0;
    const claimedMilestones = stats?.claimedStreakMilestones || [];

    // Get next unclaimed milestone
    const nextMilestone = await this.milestoneModel
      .findOne({
        isActive: true,
        day: { $gt: currentStreak },
      })
      .sort({ day: 1 })
      .exec();

    // Get claimable milestones
    const claimableMilestones = await this.getClaimableMilestones(userId);

    return {
      currentStreak,
      nextMilestone,
      claimedMilestones,
      claimableMilestones,
    };
  }

  /**
   * Claim a milestone reward
   */
  async claimMilestone(
    userId: string,
    day: number,
  ): Promise<MilestoneClaimResult | null> {
    const userObjectId = new Types.ObjectId(userId);

    // Get milestone
    const milestone = await this.milestoneModel
      .findOne({ day, isActive: true })
      .exec();

    if (!milestone) {
      return null;
    }

    // Get user stats
    const stats = await this.userStatsModel
      .findOne({ userId: userObjectId })
      .exec();

    if (!stats) {
      return null;
    }

    // Check if already claimed
    const claimedDays = stats.claimedStreakMilestones || [];
    if (claimedDays.includes(day)) {
      return null; // Already claimed
    }

    // Check if streak is sufficient
    if (stats.streakCount < day) {
      return null; // Streak not high enough
    }

    // Apply rewards
    const reward = milestone.reward;
    let gemsAwarded = 0;
    let xpBoostApplied = false;
    let streakFreezeAwarded = false;

    // Award gems
    if (reward.gems && reward.gems > 0) {
      stats.gems += reward.gems;
      gemsAwarded = reward.gems;
    }

    // Apply XP boost
    if (reward.xpBoostMultiplier && reward.xpBoostDurationMinutes) {
      stats.xpBoostMultiplier = reward.xpBoostMultiplier;
      stats.xpBoostExpiresAt = new Date(
        Date.now() + reward.xpBoostDurationMinutes * 60 * 1000,
      );
      xpBoostApplied = true;
    }

    // Award streak freeze (add to inventory - simplified by incrementing a counter)
    if (reward.streakFreeze) {
      // In a full implementation, you'd add this to a user inventory
      // For now, we'll activate it immediately
      stats.streakFreezeActive = true;
      stats.streakFreezeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      streakFreezeAwarded = true;
    }

    // Mark milestone as claimed
    stats.claimedStreakMilestones = [...claimedDays, day];
    stats.lastClaimedStreakMilestone = Math.max(
      stats.lastClaimedStreakMilestone || 0,
      day,
    );

    await stats.save();

    this.logger.log(`User ${userId} claimed milestone for ${day}-day streak`);

    return {
      milestone,
      reward,
      gemsAwarded,
      xpBoostApplied,
      streakFreezeAwarded,
    };
  }

  /**
   * Check for new claimable milestones after streak update
   */
  async checkNewMilestones(
    userId: string,
    newStreakCount: number,
  ): Promise<StreakMilestoneDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const stats = await this.userStatsModel
      .findOne({ userId: userObjectId })
      .exec();

    const claimedDays = stats?.claimedStreakMilestones || [];

    // Find milestones that just became available
    return this.milestoneModel
      .find({
        isActive: true,
        day: { $lte: newStreakCount, $nin: claimedDays },
      })
      .sort({ day: 1 })
      .exec();
  }
}
