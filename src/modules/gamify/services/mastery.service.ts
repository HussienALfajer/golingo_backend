/**
 * Mastery Service
 * Service for managing skill mastery and crown levels
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SkillProgress,
  SkillProgressDocument,
  CrownLevel,
} from '../schemas/skill-progress.schema';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';
import {
  CrownLeveledUpEvent,
  XPGainedEvent,
} from '../../../common/events/gamification.events';

@Injectable()
export class MasteryService {
  // XP required for each crown level (cumulative)
  private readonly CROWN_XP_REQUIREMENTS: Record<number, number> = {
    0: 0,
    1: 60, // Level 1: 60 XP
    2: 120, // Level 2: 120 XP (60 more)
    3: 180, // Level 3: 180 XP (60 more)
    4: 240, // Level 4: 240 XP (60 more)
    5: 300, // Level 5: 300 XP (60 more)
  };

  // Legendary challenge requires 500 XP total
  private readonly LEGENDARY_XP_REQUIREMENT = 500;

  constructor(
    @InjectModel(SkillProgress.name)
    private skillProgressModel: Model<SkillProgressDocument>,
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get or create skill progress
   */
  async getOrCreateSkillProgress(
    userId: string,
    skillId: string,
  ): Promise<SkillProgressDocument> {
    let progress = await this.skillProgressModel
      .findOne({
        userId: new Types.ObjectId(userId),
        skillId: new Types.ObjectId(skillId),
      })
      .exec();

    if (!progress) {
      progress = new this.skillProgressModel({
        userId: new Types.ObjectId(userId),
        skillId: new Types.ObjectId(skillId),
        crownLevel: CrownLevel.LEVEL_0,
        currentXP: 0,
        xpToNextCrown: this.CROWN_XP_REQUIREMENTS[1],
        totalXP: 0,
        mistakeCount: 0,
        practiceCount: 0,
        isLegendary: false,
        legendaryAttempts: 0,
      });
      await progress.save();
    }

    return progress;
  }

  /**
   * Add XP to skill and check for level ups
   */
  async addSkillXP(
    userId: string,
    skillId: string,
    xpAmount: number,
    mistakes: number = 0,
    isPractice: boolean = false,
  ): Promise<{
    progress: SkillProgressDocument;
    leveledUp: boolean;
    newCrownLevel?: CrownLevel;
    xpReward?: number;
  }> {
    const progress = await this.getOrCreateSkillProgress(userId, skillId);

    const oldCrownLevel = progress.crownLevel;
    progress.totalXP += xpAmount;
    progress.currentXP += xpAmount;
    progress.mistakeCount += mistakes;

    if (isPractice) {
      progress.practiceCount += 1;
    }

    progress.lastPracticedAt = new Date();

    // Check for crown level up
    let leveledUp = false;
    let newCrownLevel: CrownLevel | undefined;
    let xpReward = 0;

    if (
      progress.crownLevel < CrownLevel.LEVEL_5 &&
      progress.totalXP >= this.CROWN_XP_REQUIREMENTS[progress.crownLevel + 1]
    ) {
      // Level up!
      leveledUp = true;
      newCrownLevel = (progress.crownLevel + 1) as CrownLevel;
      progress.crownLevel = newCrownLevel;

      // Calculate XP needed for next crown
      if (progress.crownLevel < CrownLevel.LEVEL_5) {
        progress.xpToNextCrown =
          this.CROWN_XP_REQUIREMENTS[progress.crownLevel + 1] - progress.totalXP;
      } else {
        // Max level reached
        progress.xpToNextCrown = 0;
      }

      // Set timestamps
      if (!progress.firstCrownAt) {
        progress.firstCrownAt = new Date();
      }
      progress.lastCrownAt = new Date();

      // Award XP bonus for level up
      xpReward = (newCrownLevel as number) * 10; // 10 XP per crown level

      // Update user stats
      const stats = await this.userStatsModel.findOne({ userId }).exec();
      if (stats) {
        stats.totalCrowns = (stats.totalCrowns || 0) + 1;
        if (newCrownLevel === CrownLevel.LEVEL_5) {
          stats.skillsMastered = (stats.skillsMastered || 0) + 1;
        }
        await stats.save();
      }

      // Emit crown leveled up event
      this.eventEmitter.emit('crown.leveled_up', {
        userId: userId,
        skillId: skillId,
        fromLevel: oldCrownLevel,
        toLevel: newCrownLevel,
        xpReward: xpReward,
      } as CrownLeveledUpEvent);

      // Emit XP gained event for the bonus
      if (xpReward > 0) {
        this.eventEmitter.emit('xp.gained', {
          userId: userId,
          xpAmount: xpReward,
          source: 'crown_level_up',
          metadata: { skillId, crownLevel: newCrownLevel },
        } as XPGainedEvent);
      }
    } else {
      // Update XP to next crown
      if (progress.crownLevel < CrownLevel.LEVEL_5) {
        progress.xpToNextCrown =
          this.CROWN_XP_REQUIREMENTS[progress.crownLevel + 1] - progress.totalXP;
      }
    }

    await progress.save();

    return {
      progress,
      leveledUp,
      newCrownLevel,
      xpReward,
    };
  }

  /**
   * Check if skill can unlock legendary challenge
   */
  async canUnlockLegendary(userId: string, skillId: string): Promise<boolean> {
    const progress = await this.getOrCreateSkillProgress(userId, skillId);

    return (
      progress.crownLevel === CrownLevel.LEVEL_5 &&
      progress.totalXP >= this.LEGENDARY_XP_REQUIREMENT &&
      !progress.isLegendary
    );
  }

  /**
   * Attempt legendary challenge
   */
  async attemptLegendary(
    userId: string,
    skillId: string,
    passed: boolean,
  ): Promise<{
    progress: SkillProgressDocument;
    unlocked: boolean;
  }> {
    const progress = await this.getOrCreateSkillProgress(userId, skillId);

    if (!this.canUnlockLegendary(userId, skillId)) {
      throw new NotFoundException('Legendary challenge not available');
    }

    progress.legendaryAttempts += 1;

    if (passed) {
      progress.isLegendary = true;
      progress.legendaryCompletedAt = new Date();

      // Update user stats
      const stats = await this.userStatsModel.findOne({ userId }).exec();
      if (stats) {
        stats.skillsMastered = (stats.skillsMastered || 0) + 1;
        await stats.save();
      }
    }

    await progress.save();

    return {
      progress,
      unlocked: progress.isLegendary,
    };
  }

  /**
   * Get user's skill mastery overview
   */
  async getUserMasteryOverview(userId: string): Promise<{
    totalCrowns: number;
    skillsMastered: number;
    legendarySkills: number;
    totalSkills: number;
    skillsByLevel: Record<number, number>;
    recentProgress: SkillProgressDocument[];
  }> {
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    const allSkills = await this.skillProgressModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();

    const legendarySkills = allSkills.filter((s) => s.isLegendary).length;

    // Count skills by crown level
    const skillsByLevel: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const skill of allSkills) {
      const level = skill.crownLevel;
      if (level in skillsByLevel) {
        skillsByLevel[level] += 1;
      }
    }

    // Get recently practiced skills
    const recentProgress = await this.skillProgressModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ lastPracticedAt: -1 })
      .limit(10)
      .exec();

    return {
      totalCrowns: stats?.totalCrowns || 0,
      skillsMastered: stats?.skillsMastered || 0,
      legendarySkills,
      totalSkills: allSkills.length,
      skillsByLevel,
      recentProgress,
    };
  }

  /**
   * Get skill progress for a specific skill
   */
  async getSkillProgress(
    userId: string,
    skillId: string,
  ): Promise<SkillProgressDocument> {
    const progress = await this.getOrCreateSkillProgress(userId, skillId);
    return progress;
  }

  /**
   * Practice skill (for earning hearts)
   */
  async practiceSkill(
    userId: string,
    skillId: string,
    xpGained: number,
    mistakes: number = 0,
  ): Promise<{
    progress: SkillProgressDocument;
    leveledUp: boolean;
    newCrownLevel?: CrownLevel;
  }> {
    const result = await this.addSkillXP(
      userId,
      skillId,
      xpGained,
      mistakes,
      true, // isPractice
    );

    return {
      progress: result.progress,
      leveledUp: result.leveledUp,
      newCrownLevel: result.newCrownLevel,
    };
  }
}

