/**
 * Achievements Service
 * Service for managing achievements and user achievements
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Achievement, AchievementDocument } from './schemas/achievement.schema';
import {
  UserAchievement,
  UserAchievementDocument,
} from './schemas/user-achievement.schema';
import { AchievementCriteriaType } from '../../common/enums/achievement-criteria-type.enum';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectModel(Achievement.name)
    private achievementModel: Model<AchievementDocument>,
    @InjectModel(UserAchievement.name)
    private userAchievementModel: Model<UserAchievementDocument>,
  ) {}

  /**
   * Create a new achievement
   */
  async create(
    createDto: Partial<AchievementDocument>,
  ): Promise<AchievementDocument> {
    const achievement = new this.achievementModel(createDto);
    return achievement.save();
  }

  /**
   * Find all active achievements
   */
  async findAll(): Promise<AchievementDocument[]> {
    return this.achievementModel.find({ isActive: true }).exec();
  }

  /**
   * Find achievement by ID
   */
  async findOne(id: string): Promise<AchievementDocument> {
    const achievement = await this.achievementModel.findById(id).exec();
    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }
    return achievement;
  }

  /**
   * Find achievement by code
   */
  async findByCode(code: string): Promise<AchievementDocument | null> {
    return this.achievementModel.findOne({ code: code.toUpperCase() }).exec();
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(
    userId: string,
  ): Promise<UserAchievementDocument[]> {
    return this.userAchievementModel
      .find({ userId })
      .populate('achievementId')
      .sort({ unlockedAt: -1 })
      .exec();
  }

  /**
   * Check and unlock achievement for user
   */
  async checkAndUnlockAchievement(
    userId: string,
    achievementCode: string,
    metadata?: Record<string, any>,
  ): Promise<UserAchievementDocument | null> {
    // Find achievement
    const achievement = await this.findByCode(achievementCode);
    if (!achievement || !achievement.isActive) {
      return null;
    }

    // Check if user already has this achievement
    const existing = await this.userAchievementModel
      .findOne({ userId, achievementId: achievement._id })
      .exec();

    if (existing) {
      return existing; // Already unlocked
    }

    // Unlock achievement
    const userAchievement = new this.userAchievementModel({
      userId,
      achievementId: achievement._id,
      unlockedAt: new Date(),
      metadata: metadata || {},
    });

    return userAchievement.save();
  }

  /**
   * Initialize default achievements
   */
  async initializeDefaultAchievements(): Promise<void> {
    const defaults = [
      {
        code: 'FIRST_VIDEO_WATCHED',
        title: 'First Steps',
        description: 'Watch your first video',
        criteriaType: AchievementCriteriaType.VIDEO_WATCHED_COUNT,
        criteriaConfig: { count: 1 },
        isActive: true,
      },
      {
        code: 'FIRST_CATEGORY_COMPLETED',
        title: 'Category Master',
        description: 'Complete your first category',
        criteriaType: AchievementCriteriaType.CATEGORY_COMPLETED,
        criteriaConfig: {},
        isActive: true,
      },
      {
        code: 'FIRST_LEVEL_COMPLETED',
        title: 'Level Up',
        description: 'Complete your first level',
        criteriaType: AchievementCriteriaType.LEVEL_COMPLETED,
        criteriaConfig: {},
        isActive: true,
      },
      {
        code: 'PERFECT_SCORE',
        title: 'Perfect Score',
        description: 'Get 100% on any quiz',
        criteriaType: AchievementCriteriaType.HIGH_SCORE,
        criteriaConfig: { score: 100 },
        isActive: true,
      },
      {
        code: 'CONSISTENCY_STREAK',
        title: 'Consistency',
        description: 'Watch videos for 7 days in a row',
        criteriaType: AchievementCriteriaType.STREAK,
        criteriaConfig: { days: 7 },
        isActive: true,
      },
    ];

    for (const achievement of defaults) {
      const existing = await this.findByCode(achievement.code);
      if (!existing) {
        await this.create(achievement);
      }
    }
  }

  /**
   * Update achievement
   */
  async update(
    id: string,
    updateData: Partial<AchievementDocument>,
  ): Promise<AchievementDocument> {
    const achievement = await this.achievementModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }
    return achievement;
  }

  /**
   * Delete achievement
   */
  async remove(id: string): Promise<void> {
    const result = await this.achievementModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Achievement not found');
    }
  }
}
