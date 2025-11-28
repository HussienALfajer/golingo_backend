/**
 * Shop Service
 * Service for managing shop items and purchases
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ShopItem,
  ShopItemDocument,
  ShopItemType,
} from './schemas/shop-item.schema';
import { Purchase, PurchaseDocument } from './schemas/purchase.schema';
import { PurchaseDto } from './dto/purchase.dto';
import { GamifyService } from './gamify.service';
import { UserStatsDocument } from './schemas/user-stats.schema';
import { StreakService } from './services/streak.service';
import { HeartsService } from './services/hearts.service';

@Injectable()
export class ShopService {
  constructor(
    @InjectModel(ShopItem.name) private shopItemModel: Model<ShopItemDocument>,
    @InjectModel(Purchase.name) private purchaseModel: Model<PurchaseDocument>,
    private readonly gamifyService: GamifyService,
    private readonly streakService: StreakService,
    private readonly heartsService: HeartsService,
  ) {}

  /**
   * Get all active shop items
   */
  async getAllItems(): Promise<ShopItemDocument[]> {
    return this.shopItemModel
      .find({ isActive: true })
      .sort({ type: 1, priceGems: 1 })
      .exec();
  }

  /**
   * Get shop item by ID
   */
  async getItemById(itemId: string): Promise<ShopItemDocument> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException('Invalid item ID');
    }
    const item = await this.shopItemModel.findById(itemId).exec();
    if (!item || !item.isActive) {
      throw new NotFoundException('Shop item not found');
    }
    return item;
  }

  /**
   * Purchase a shop item
   */
  async purchaseItem(
    userId: string,
    purchaseDto: PurchaseDto,
  ): Promise<{
    purchase: PurchaseDocument;
    stats: UserStatsDocument;
  }> {
    const userObjectId = new Types.ObjectId(userId);
    const item = await this.getItemById(purchaseDto.shopItemId);

    // Get user stats to check gems
    const stats = await this.gamifyService.getUserStats(userId);

    // Check if user has enough gems
    if (stats.gems < item.priceGems) {
      throw new BadRequestException('Insufficient gems');
    }

    // Check stock limit (if applicable)
    if (item.stockLimit >= 0) {
      const purchaseCount = await this.purchaseModel
        .countDocuments({ shopItemId: item._id })
        .exec();
      if (purchaseCount >= item.stockLimit) {
        throw new BadRequestException('Item out of stock');
      }
    }

    // Deduct gems
    stats.gems -= item.priceGems;
    await stats.save();

    // Apply item effect
    await this.applyItemEffect(userId, item);

    // Create purchase record
    const purchase = new this.purchaseModel({
      userId: userObjectId,
      shopItemId: item._id,
      gemsSpent: item.priceGems,
      metadata: {
        itemType: item.type,
        itemCode: item.code,
        effectConfig: item.effectConfig,
      },
    });
    await purchase.save();

    // Refresh stats after purchase
    const updatedStats = await this.gamifyService.getUserStats(userId);

    return {
      purchase,
      stats: updatedStats,
    };
  }

  /**
   * Apply the effect of a purchased item
   */
  private async applyItemEffect(
    userId: string,
    item: ShopItemDocument,
  ): Promise<void> {
    switch (item.type) {
      case ShopItemType.STREAK_FREEZE:
        // Streak freeze prevents streak reset for one day
        await this.gamifyService.useStreakFreeze(userId);
        break;

      case ShopItemType.ENERGY_REFILL:
        // Refill energy (default to max, or use config)
        const energyAmount = item.effectConfig?.energyAmount || 25;
        await this.gamifyService.refillEnergy(userId, energyAmount);
        break;

      case ShopItemType.XP_BOOST:
        // Apply XP boost multiplier for a duration
        const multiplier = item.effectConfig?.xpMultiplier || 1.5;
        const durationMinutes = item.effectConfig?.durationMinutes || 60;
        await this.gamifyService.applyXPBoost(
          userId,
          multiplier,
          durationMinutes,
        );
        break;

      case ShopItemType.HEART_REFILL:
        // Refill hearts (default to max, or use config)
        const heartAmount = item.effectConfig?.heartAmount || 5;
        await this.gamifyService.refillHearts(userId, heartAmount);
        break;

      case ShopItemType.WEEKEND_AMULET:
        // Activate weekend amulet (protects streak for 48 hours)
        await this.streakService.activateWeekendAmulet(userId);
        break;

      case ShopItemType.TIMER_BOOST:
        // Timer boost is handled on client side or quiz service
        // For now, we'll just record the purchase
        break;

      case ShopItemType.STREAK_REPAIR:
        // Repair broken streak
        await this.streakService.repairStreak(userId);
        break;

      default:
        throw new BadRequestException(`Unknown item type: ${item.type}`);
    }
  }

  /**
   * Initialize default shop items
   */
  async initializeDefaultItems(): Promise<void> {
    const defaults = [
      {
        code: 'streak_freeze',
        type: ShopItemType.STREAK_FREEZE,
        name: 'Streak Freeze',
        description: 'Protect your streak for one day',
        priceGems: 10,
        effectConfig: {},
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'energy_refill',
        type: ShopItemType.ENERGY_REFILL,
        name: 'Energy Refill',
        description: 'Refill your energy to maximum',
        priceGems: 15,
        effectConfig: { energyAmount: 25 },
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'xp_boost_1h',
        type: ShopItemType.XP_BOOST,
        name: 'XP Boost (1 hour)',
        description: 'Earn 1.5x XP for 1 hour',
        priceGems: 20,
        effectConfig: { xpMultiplier: 1.5, durationMinutes: 60 },
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'heart_refill',
        type: ShopItemType.HEART_REFILL,
        name: 'Heart Refill',
        description: 'Refill your hearts to maximum (5 hearts)',
        priceGems: 15,
        effectConfig: { heartAmount: 5 },
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'weekend_amulet',
        type: ShopItemType.WEEKEND_AMULET,
        name: 'Weekend Amulet',
        description: 'Protect your streak for the weekend (48 hours)',
        priceGems: 30,
        effectConfig: { durationHours: 48 },
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'timer_boost',
        type: ShopItemType.TIMER_BOOST,
        name: 'Timer Boost',
        description: 'Increase time limit for quizzes',
        priceGems: 10,
        effectConfig: { timeMultiplier: 1.5 },
        isActive: true,
        stockLimit: -1,
      },
      {
        code: 'streak_repair',
        type: ShopItemType.STREAK_REPAIR,
        name: 'Streak Repair',
        description: 'Repair your broken streak',
        priceGems: 50,
        effectConfig: {},
        isActive: true,
        stockLimit: -1,
      },
    ];

    for (const itemData of defaults) {
      const existing = await this.shopItemModel
        .findOne({ code: itemData.code })
        .exec();
      if (!existing) {
        try {
          const item = new this.shopItemModel(itemData);
          await item.save();
        } catch (error: any) {
          // Ignore duplicate key errors (item might have been created between check and insert)
          if (error.code !== 11000) {
            throw error;
          }
        }
      }
    }
  }
}
