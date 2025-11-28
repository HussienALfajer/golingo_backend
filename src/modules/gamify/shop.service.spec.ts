/**
 * Shop Service Unit Tests
 * Tests for purchaseItem method
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopService } from './shop.service';
import { ShopItem, ShopItemDocument } from './schemas/shop-item.schema';
import { Purchase, PurchaseDocument } from './schemas/purchase.schema';
import { GamifyService } from './gamify.service';
import { PurchaseDto } from './dto/purchase.dto';
import { ShopItemType } from './schemas/shop-item.schema';

describe('ShopService', () => {
  let service: ShopService;
  let shopItemModel: Model<ShopItemDocument>;
  let purchaseModel: Model<PurchaseDocument>;
  let gamifyService: GamifyService;

  const mockShopItemModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  };

  const mockPurchaseModel = {
    create: jest.fn(),
    save: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockGamifyService = {
    getUserStats: jest.fn(),
    useStreakFreeze: jest.fn(),
    refillEnergy: jest.fn(),
    applyXPBoost: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        {
          provide: getModelToken(ShopItem.name),
          useValue: mockShopItemModel,
        },
        {
          provide: getModelToken(Purchase.name),
          useValue: mockPurchaseModel,
        },
        {
          provide: GamifyService,
          useValue: mockGamifyService,
        },
      ],
    }).compile();

    service = module.get<ShopService>(ShopService);
    shopItemModel = module.get<Model<ShopItemDocument>>(
      getModelToken(ShopItem.name),
    );
    purchaseModel = module.get<Model<PurchaseDocument>>(
      getModelToken(Purchase.name),
    );
    gamifyService = module.get<GamifyService>(GamifyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('purchaseItem', () => {
    const userId = '507f1f77bcf86cd799439011';
    const itemId = 'item123';

    const mockItem: Partial<ShopItemDocument> = {
      _id: itemId,
      code: 'streak_freeze',
      type: ShopItemType.STREAK_FREEZE,
      name: 'Streak Freeze',
      priceGems: 10,
      effectConfig: {},
      isActive: true,
      stockLimit: -1,
    };

    const mockStats: any = {
      _id: 'stats123',
      userId: userId,
      xp: 100,
      energy: 20,
      gems: 15,
      streakCount: 5,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockPurchase: Partial<PurchaseDocument> = {
      _id: 'purchase123',
      userId: userId as any,
      shopItemId: itemId as any,
      gemsSpent: 10,
      metadata: {},
      save: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      mockShopItemModel.findById = jest.fn().mockResolvedValue(mockItem);
      mockGamifyService.getUserStats = jest.fn().mockResolvedValue(mockStats);
      mockPurchaseModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockPurchaseModel.create = jest.fn().mockImplementation((data) => ({
        ...mockPurchase,
        ...data,
        save: jest.fn().mockResolvedValue(true),
      }));
      mockGamifyService.useStreakFreeze = jest
        .fn()
        .mockResolvedValue(undefined);
    });

    it('should successfully purchase an item with sufficient gems', async () => {
      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      const result = await service.purchaseItem(userId, purchaseDto);

      expect(mockGamifyService.getUserStats).toHaveBeenCalledWith(userId);
      expect(mockStats.gems).toBe(5); // 15 - 10
      expect(mockStats.save).toHaveBeenCalled();
      expect(mockGamifyService.useStreakFreeze).toHaveBeenCalledWith(userId);
      expect(result.purchase).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should throw error when user has insufficient gems', async () => {
      const lowGemsStats = { ...mockStats, gems: 5 };
      mockGamifyService.getUserStats = jest
        .fn()
        .mockResolvedValue(lowGemsStats);

      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      await expect(service.purchaseItem(userId, purchaseDto)).rejects.toThrow(
        'Insufficient gems',
      );
    });

    it('should throw error when item is out of stock', async () => {
      const limitedItem = { ...mockItem, stockLimit: 1 };
      mockShopItemModel.findById = jest.fn().mockResolvedValue(limitedItem);
      mockPurchaseModel.countDocuments = jest.fn().mockResolvedValue(1); // Already purchased

      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      await expect(service.purchaseItem(userId, purchaseDto)).rejects.toThrow(
        'out of stock',
      );
    });

    it('should apply streak freeze effect for streak_freeze item', async () => {
      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      await service.purchaseItem(userId, purchaseDto);

      expect(mockGamifyService.useStreakFreeze).toHaveBeenCalledWith(userId);
    });

    it('should apply energy refill effect for energy_refill item', async () => {
      const energyItem = {
        ...mockItem,
        type: ShopItemType.ENERGY_REFILL,
        code: 'energy_refill',
      };
      mockShopItemModel.findById = jest.fn().mockResolvedValue(energyItem);
      mockGamifyService.refillEnergy = jest.fn().mockResolvedValue(undefined);

      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      await service.purchaseItem(userId, purchaseDto);

      expect(mockGamifyService.refillEnergy).toHaveBeenCalledWith(userId, 25);
    });

    it('should apply XP boost effect for xp_boost item', async () => {
      const xpBoostItem = {
        ...mockItem,
        type: ShopItemType.XP_BOOST,
        code: 'xp_boost_1h',
        effectConfig: { xpMultiplier: 1.5, durationMinutes: 60 },
      };
      mockShopItemModel.findById = jest.fn().mockResolvedValue(xpBoostItem);
      mockGamifyService.applyXPBoost = jest.fn().mockResolvedValue(undefined);

      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      await service.purchaseItem(userId, purchaseDto);

      expect(mockGamifyService.applyXPBoost).toHaveBeenCalledWith(
        userId,
        1.5,
        60,
      );
    });

    it('should create purchase record', async () => {
      const purchaseDto: PurchaseDto = {
        shopItemId: itemId,
      };

      const result = await service.purchaseItem(userId, purchaseDto);

      expect(mockPurchaseModel.create).toHaveBeenCalled();
      expect(result.purchase.gemsSpent).toBe(10);
      expect(result.purchase.metadata.itemType).toBe(
        ShopItemType.STREAK_FREEZE,
      );
    });
  });
});
