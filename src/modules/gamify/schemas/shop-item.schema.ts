/**
 * Shop Item Schema
 * MongoDB schema for items available in the shop (streak_freeze, energy_refill, xp_boost)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShopItemDocument = ShopItem & Document;

export enum ShopItemType {
  STREAK_FREEZE = 'streak_freeze',
  ENERGY_REFILL = 'energy_refill',
  HEART_REFILL = 'heart_refill',
  XP_BOOST = 'xp_boost',
  WEEKEND_AMULET = 'weekend_amulet',
  TIMER_BOOST = 'timer_boost',
  STREAK_REPAIR = 'streak_repair',
}

@Schema({ timestamps: true, collection: 'shop_items' })
export class ShopItem {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  code: string;

  @Prop({ required: true, enum: ShopItemType })
  type: ShopItemType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String })
  iconUrl?: string;

  @Prop({ required: true, type: Number, min: 0 })
  priceGems: number;

  @Prop({ type: Object, default: {} })
  effectConfig: Record<string, any>; // e.g., { energyAmount: 25 }, { xpMultiplier: 1.5 }

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: -1 })
  stockLimit: number; // -1 for unlimited

  createdAt?: Date;
  updatedAt?: Date;
}

export const ShopItemSchema = SchemaFactory.createForClass(ShopItem);

// Indexes
ShopItemSchema.index({ code: 1 }, { unique: true });
ShopItemSchema.index({ type: 1, isActive: 1 });
