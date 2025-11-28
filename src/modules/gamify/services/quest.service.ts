/**
 * Quest Service
 * Service for managing daily quests and challenges
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DailyQuest,
  DailyQuestDocument,
  QuestType,
  QuestStatus,
} from '../schemas/daily-quest.schema';
import {
  QuestTemplate,
  QuestTemplateDocument,
} from '../schemas/quest-template.schema';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';
import { QuestCompletedEvent, XPGainedEvent } from '../../../common/events/gamification.events';

@Injectable()
export class QuestService {
  private readonly MAX_DAILY_QUESTS = 3;
  private readonly QUEST_EXPIRATION_HOURS = 24;

  constructor(
    @InjectModel(DailyQuest.name)
    private dailyQuestModel: Model<DailyQuestDocument>,
    @InjectModel(QuestTemplate.name)
    private questTemplateModel: Model<QuestTemplateDocument>,
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Initialize default quest templates
   */
  async initializeDefaultTemplates(): Promise<void> {
    const defaults = [
      {
        questType: QuestType.EARN_XP,
        title: 'Earn XP',
        description: 'Earn {{target}} XP today',
        defaultTarget: { xp: 50 },
        defaultReward: 10,
        defaultExpirationHours: 24,
        targetRanges: { xp: { min: 40, max: 100 } },
        priority: 10,
      },
      {
        questType: QuestType.COMPLETE_LESSONS,
        title: 'Complete Lessons',
        description: 'Complete {{target}} lessons today',
        defaultTarget: { lessons: 2 },
        defaultReward: 15,
        defaultExpirationHours: 24,
        targetRanges: { lessons: { min: 2, max: 5 } },
        priority: 8,
      },
      {
        questType: QuestType.PRACTICE_SKILL,
        title: 'Practice Skills',
        description: 'Practice {{target}} skill(s) today',
        defaultTarget: { skills: 1 },
        defaultReward: 10,
        defaultExpirationHours: 24,
        targetRanges: { skills: { min: 1, max: 3 } },
        priority: 7,
      },
      {
        questType: QuestType.MAINTAIN_STREAK,
        title: 'Maintain Your Streak',
        description: 'Maintain your streak for today',
        defaultTarget: { days: 1 },
        defaultReward: 5,
        defaultExpirationHours: 24,
        targetRanges: { days: { min: 1, max: 1 } },
        priority: 9,
      },
      {
        questType: QuestType.PERFECT_PRACTICE,
        title: 'Perfect Practice',
        description: 'Get 100% correct in a practice session',
        defaultTarget: { perfect: 1 },
        defaultReward: 20,
        defaultExpirationHours: 24,
        targetRanges: { perfect: { min: 1, max: 1 } },
        priority: 6,
      },
      {
        questType: QuestType.COMPLETE_QUIZ,
        title: 'Complete Quiz',
        description: 'Complete {{target}} quiz(zes) today',
        defaultTarget: { quizzes: 1 },
        defaultReward: 15,
        defaultExpirationHours: 24,
        targetRanges: { quizzes: { min: 1, max: 3 } },
        priority: 7,
      },
    ];

    for (const templateData of defaults) {
      const existing = await this.questTemplateModel
        .findOne({ questType: templateData.questType })
        .exec();
      if (!existing) {
        try {
          const template = new this.questTemplateModel(templateData);
          await template.save();
        } catch (error: any) {
          // Ignore duplicate key errors (template might have been created between check and insert)
          if (error.code !== 11000) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Generate daily quests for user
   */
  async generateDailyQuests(userId: string): Promise<DailyQuestDocument[]> {
    // Delete expired quests
    await this.deleteExpiredQuests(userId);

    // Check existing active quests
    const existingQuests = await this.dailyQuestModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [QuestStatus.PENDING, QuestStatus.IN_PROGRESS] },
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (existingQuests.length >= this.MAX_DAILY_QUESTS) {
      return existingQuests;
    }

    // Get available templates
    const templates = await this.questTemplateModel
      .find({ isActive: true })
      .sort({ priority: -1 })
      .exec();

    // Filter out quest types already assigned
    const existingTypes = existingQuests.map((q) => q.questType);
    const availableTemplates = templates.filter(
      (t) => !existingTypes.includes(t.questType),
    );

    // Generate new quests
    const questsToGenerate = Math.min(
      this.MAX_DAILY_QUESTS - existingQuests.length,
      availableTemplates.length,
    );

    const newQuests: DailyQuestDocument[] = [];

    for (let i = 0; i < questsToGenerate; i++) {
      const template = availableTemplates[i];
      if (!template) break;

      // Generate target based on template ranges
      const target = this.generateQuestTarget(template);

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(
        expiresAt.getHours() + template.defaultExpirationHours,
      );

      const quest = new this.dailyQuestModel({
        userId: new Types.ObjectId(userId),
        questType: template.questType,
        title: template.title,
        description: this.formatQuestDescription(
          template.description || '',
          target,
        ),
        iconUrl: template.iconUrl,
        target: target,
        progress: 0,
        reward: template.defaultReward,
        status: QuestStatus.PENDING,
        expiresAt,
      });

      await quest.save();
      newQuests.push(quest);
    }

    return [...existingQuests, ...newQuests];
  }

  /**
   * Generate quest target based on template
   */
  private generateQuestTarget(template: QuestTemplateDocument): number {
    const ranges = template.targetRanges;
    if (!ranges || Object.keys(ranges).length === 0) {
      return template.defaultTarget?.[Object.keys(template.defaultTarget)[0]] || 1;
    }

    const firstKey = Object.keys(ranges)[0];
    const range = ranges[firstKey];
    if (range.min !== undefined && range.max !== undefined) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    return template.defaultTarget?.[firstKey] || 1;
  }

  /**
   * Format quest description with target
   */
  private formatQuestDescription(description: string, target: number): string {
    return description.replace(/\{\{target\}\}/g, target.toString());
  }

  /**
   * Update quest progress
   */
  async updateQuestProgress(
    userId: string,
    questType: QuestType,
    progress: number,
  ): Promise<DailyQuestDocument[]> {
    const now = new Date();
    const activeQuests = await this.dailyQuestModel
      .find({
        userId: new Types.ObjectId(userId),
        questType,
        status: { $in: [QuestStatus.PENDING, QuestStatus.IN_PROGRESS] },
        expiresAt: { $gt: now },
      })
      .exec();

    const completedQuests: DailyQuestDocument[] = [];

    for (const quest of activeQuests) {
      quest.progress += progress;
      quest.status = QuestStatus.IN_PROGRESS;

      // Check if quest is completed
      if (quest.progress >= quest.target) {
        quest.progress = quest.target; // Cap at target
        quest.status = QuestStatus.COMPLETED;
        quest.completedAt = now;

        // Emit quest completed event
        this.eventEmitter.emit('quest.completed', {
          userId: userId,
          questId: (quest._id as any).toString(),
          questType: quest.questType,
          reward: quest.reward,
        } as QuestCompletedEvent);

        completedQuests.push(quest);
      }

      await quest.save();
    }

    return completedQuests;
  }

  /**
   * Claim quest reward
   */
  async claimQuestReward(userId: string, questId: string): Promise<{
    quest: DailyQuestDocument;
    stats: UserStatsDocument;
  }> {
    const quest = await this.dailyQuestModel
      .findOne({
        _id: new Types.ObjectId(questId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    if (quest.status !== QuestStatus.COMPLETED) {
      throw new NotFoundException('Quest not completed');
    }

    // Update quest status
    quest.status = QuestStatus.CLAIMED;
    quest.claimedAt = new Date();
    await quest.save();

    // Award gems
    const stats = await this.userStatsModel.findOne({ userId }).exec();
    if (stats) {
      stats.gems = (stats.gems || 0) + quest.reward;
      await stats.save();
    }

    return { quest, stats: stats! };
  }

  /**
   * Get user's active quests
   */
  async getUserQuests(userId: string): Promise<DailyQuestDocument[]> {
    const now = new Date();
    return this.dailyQuestModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [QuestStatus.PENDING, QuestStatus.IN_PROGRESS, QuestStatus.COMPLETED] },
        expiresAt: { $gt: now },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Handle XP gained event
   */
  async handleXPGained(userId: string, xpAmount: number): Promise<void> {
    await this.updateQuestProgress(userId, QuestType.EARN_XP, xpAmount);
  }

  /**
   * Handle lesson completed event
   */
  async handleLessonCompleted(userId: string): Promise<void> {
    await this.updateQuestProgress(userId, QuestType.COMPLETE_LESSONS, 1);
    await this.updateQuestProgress(userId, QuestType.COMPLETE_QUIZ, 1);
  }

  /**
   * Handle practice completed event
   */
  async handlePracticeCompleted(
    userId: string,
    skillId: string,
    perfect: boolean = false,
  ): Promise<void> {
    await this.updateQuestProgress(userId, QuestType.PRACTICE_SKILL, 1);

    if (perfect) {
      await this.updateQuestProgress(userId, QuestType.PERFECT_PRACTICE, 1);
    }
  }

  /**
   * Handle streak maintained event
   */
  async handleStreakMaintained(userId: string): Promise<void> {
    await this.updateQuestProgress(userId, QuestType.MAINTAIN_STREAK, 1);
  }

  /**
   * Delete expired quests
   */
  async deleteExpiredQuests(userId: string): Promise<void> {
    const now = new Date();
    await this.dailyQuestModel
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          expiresAt: { $lt: now },
          status: { $ne: QuestStatus.CLAIMED },
        },
        { status: QuestStatus.EXPIRED },
      )
      .exec();
  }

  /**
   * Reset daily quests (called daily at midnight)
   */
  async resetDailyQuests(userId: string): Promise<DailyQuestDocument[]> {
    // Delete expired quests
    await this.deleteExpiredQuests(userId);

    // Generate new quests
    return this.generateDailyQuests(userId);
  }
}

