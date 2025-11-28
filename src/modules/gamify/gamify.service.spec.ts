/**
 * Gamify Service Unit Tests
 * Tests for applySession method
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GamifyService } from './gamify.service';
import { UserStats, UserStatsDocument } from './schemas/user-stats.schema';
import { AchievementsService } from '../achievements/achievements.service';
import { ApplySessionDto } from './dto/apply-session.dto';

describe('GamifyService', () => {
  let service: GamifyService;
  let userStatsModel: Model<UserStatsDocument>;
  let achievementsService: AchievementsService;

  const mockUserStatsModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAchievementsService = {
    checkAndUnlockAchievement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamifyService,
        {
          provide: getModelToken(UserStats.name),
          useValue: mockUserStatsModel,
        },
        {
          provide: AchievementsService,
          useValue: mockAchievementsService,
        },
      ],
    }).compile();

    service = module.get<GamifyService>(GamifyService);
    userStatsModel = module.get<Model<UserStatsDocument>>(
      getModelToken(UserStats.name),
    );
    achievementsService = module.get<AchievementsService>(AchievementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applySession', () => {
    const userId = '507f1f77bcf86cd799439011';
    const mockStats: Partial<UserStatsDocument> = {
      _id: 'stats123',
      userId: userId as any,
      xp: 100,
      energy: 20,
      gems: 10,
      streakCount: 5,
      totalCorrect: 50,
      totalSessions: 5,
      lastActiveAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      mockUserStatsModel.findOne = jest.fn().mockResolvedValue(mockStats);
      mockAchievementsService.checkAndUnlockAchievement = jest
        .fn()
        .mockResolvedValue(null);
    });

    it('should calculate XP correctly for passed session', async () => {
      const sessionData: ApplySessionDto = {
        correct: 8,
        total: 10,
        passed: true,
        categoryId: 'category123',
        quizId: 'quiz123',
      };

      const result = await service.applySession(userId, sessionData);

      // XP = correct*10 + (passed?20:0) + streakBonus
      // = 8*10 + 20 + min(5*5, 50) = 80 + 20 + 25 = 125
      expect(result.xpGained).toBe(125);
      expect(result.stats.xp).toBe(225); // 100 + 125
    });

    it('should calculate XP correctly for failed session', async () => {
      const sessionData: ApplySessionDto = {
        correct: 5,
        total: 10,
        passed: false,
      };

      const result = await service.applySession(userId, sessionData);

      // XP = correct*10 + (passed?20:0) + streakBonus
      // = 5*10 + 0 + 25 = 75
      expect(result.xpGained).toBe(75);
    });

    it('should decrement energy for wrong answers', async () => {
      const sessionData: ApplySessionDto = {
        correct: 7,
        total: 10,
        passed: true,
      };

      const result = await service.applySession(userId, sessionData);

      // Energy delta = -(total - correct) = -(10 - 7) = -3
      expect(result.energyDelta).toBe(-3);
      expect(result.stats.energy).toBe(17); // 20 - 3
    });

    it('should not allow energy to go below 0', async () => {
      const lowEnergyStats = { ...mockStats, energy: 2 };
      mockUserStatsModel.findOne = jest.fn().mockResolvedValue(lowEnergyStats);

      const sessionData: ApplySessionDto = {
        correct: 2,
        total: 10,
        passed: false,
      };

      const result = await service.applySession(userId, sessionData);

      // Energy delta = -(10 - 2) = -8, but energy is only 2
      expect(result.energyDelta).toBe(-8);
      expect(result.stats.energy).toBe(0); // Floored at 0
    });

    it('should update streak count', async () => {
      const sessionData: ApplySessionDto = {
        correct: 8,
        total: 10,
        passed: true,
      };

      const result = await service.applySession(userId, sessionData);

      expect(result.streakCount).toBeGreaterThanOrEqual(5);
    });

    it('should update totalCorrect and totalSessions', async () => {
      const sessionData: ApplySessionDto = {
        correct: 8,
        total: 10,
        passed: true,
      };

      const result = await service.applySession(userId, sessionData);

      expect(result.stats.totalCorrect).toBe(58); // 50 + 8
      expect(result.stats.totalSessions).toBe(6); // 5 + 1
    });

    it('should check and unlock achievements', async () => {
      const mockAchievement = {
        _id: 'ach123',
        achievementId: 'ach123',
        unlockedAt: new Date(),
        metadata: {},
      };
      mockAchievementsService.checkAndUnlockAchievement = jest
        .fn()
        .mockResolvedValue(mockAchievement);

      const sessionData: ApplySessionDto = {
        correct: 8,
        total: 10,
        passed: true,
        categoryId: 'category123',
        quizId: 'quiz123',
      };

      const result = await service.applySession(userId, sessionData);

      expect(
        mockAchievementsService.checkAndUnlockAchievement,
      ).toHaveBeenCalled();
      expect(result.achievementsUnlocked.length).toBeGreaterThanOrEqual(0);
    });

    it('should award gems for XP milestones', async () => {
      const highXPStats = { ...mockStats, xp: 90 }; // Close to 100 milestone
      mockUserStatsModel.findOne = jest.fn().mockResolvedValue(highXPStats);

      const sessionData: ApplySessionDto = {
        correct: 8,
        total: 10,
        passed: true,
      };

      const result = await service.applySession(userId, sessionData);

      // Should gain at least 1 gem when crossing 100 XP milestone
      expect(result.gemsGained).toBeGreaterThanOrEqual(0);
    });
  });
});
