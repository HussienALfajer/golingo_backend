/**
 * League Schema
 * MongoDB schema for league definitions (Bronze to Diamond)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeagueDocument = League & Document;

export enum LeagueTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  SAPPHIRE = 'sapphire',
  RUBY = 'ruby',
  EMERALD = 'emerald',
  AMETHYST = 'amethyst',
  PEARL = 'pearl',
  OBSIDIAN = 'obsidian',
  DIAMOND = 'diamond',
}

@Schema({ timestamps: true, collection: 'leagues' })
export class League {
  @Prop({ required: true, enum: LeagueTier, unique: true })
  tier: LeagueTier;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String })
  iconUrl?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  minXPToPromote: number;

  @Prop({ type: Number, default: 10, min: 1 })
  maxPromotions: number;

  @Prop({ type: Number, default: 0, min: 0 })
  demotionThreshold: number; // Rank below which user gets demoted

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  order: number; // Order for display (0 = Bronze, 9 = Diamond)

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LeagueSchema = SchemaFactory.createForClass(League);

// Indexes
LeagueSchema.index({ tier: 1 }, { unique: true });
LeagueSchema.index({ order: 1 });

