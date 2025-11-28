/**
 * League Session Schema
 * MongoDB schema for weekly league competition tracking
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LeagueTier } from './league.schema';

export type LeagueSessionDocument = LeagueSession & Document;

@Schema({ timestamps: true, collection: 'league_sessions' })
export class LeagueSession {
  @Prop({ required: true, enum: LeagueTier })
  tier: LeagueTier;

  @Prop({ required: true, type: Date })
  startDate: Date;

  @Prop({ required: true, type: Date })
  endDate: Date;

  @Prop({ required: true, type: Boolean, default: false })
  isActive: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  isArchived: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  participantCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LeagueSessionSchema = SchemaFactory.createForClass(LeagueSession);

// Indexes
LeagueSessionSchema.index({ tier: 1, startDate: -1 });
LeagueSessionSchema.index({ isActive: 1, tier: 1 });
LeagueSessionSchema.index({ endDate: 1, isArchived: 1 });

