/**
 * User Stats Schema
 * MongoDB schema for tracking user gamification statistics (XP, energy, gems, streak, etc.)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserStatsDocument = UserStats & Document;

@Schema({ timestamps: true, collection: 'user_stats' })
export class UserStats {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  xp: number;

  @Prop({ type: Number, default: 25, min: 0, max: 25 })
  energy: number;

  @Prop({ type: Number, default: 0, min: 0 })
  gems: number;

  @Prop({ type: Number, default: 0, min: 0 })
  streakCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  bestStreak: number;

  @Prop({ type: Date })
  lastActiveAt?: Date;

  @Prop({ type: Number, default: 0, min: 0 })
  totalCorrect: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalSessions: number;

  @Prop({ type: Number, default: 0, min: 0 })
  streakFreezesUsed: number;

  // League System Fields
  @Prop({ type: String, enum: ['bronze', 'silver', 'gold', 'sapphire', 'ruby', 'emerald', 'amethyst', 'pearl', 'obsidian', 'diamond'] })
  currentLeague?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  leagueRank: number;

  @Prop({ type: Number, default: 0, min: 0 })
  weeklyXP: number;

  @Prop({ type: Number, default: 0, min: 0 })
  allTimeXP: number;

  // Hearts System Fields
  @Prop({ type: Number, default: 5, min: 0, max: 5 })
  heartsRemaining: number;

  @Prop({ type: Date })
  lastHeartLostAt?: Date;

  @Prop({ type: Number, default: 0, min: 0 })
  practiceHeartsEarned: number;

  // Streak Protection Fields
  @Prop({ type: Boolean, default: false })
  streakFreezeActive: boolean;

  @Prop({ type: Date })
  streakFreezeExpiresAt?: Date;

  @Prop({ type: Boolean, default: false })
  weekendAmuletActive: boolean;

  // Mastery Fields
  @Prop({ type: Number, default: 0, min: 0 })
  totalCrowns: number;

  @Prop({ type: Number, default: 0, min: 0 })
  skillsMastered: number;

  // Daily Goals Fields
  @Prop({ type: Number, default: 50, min: 10 })
  dailyGoalXP: number;

  @Prop({ type: Number, default: 0, min: 0 })
  dailyGoalProgress: number;

  @Prop({ type: Date })
  lastDailyGoalReset?: Date;

  // XP Boost Fields
  @Prop({ type: Number, default: 1, min: 1 })
  xpBoostMultiplier: number;

  @Prop({ type: Date })
  xpBoostExpiresAt?: Date;

  // Streak Milestone Tracking
  @Prop({ type: Number, default: 0, min: 0 })
  lastClaimedStreakMilestone: number;

  @Prop({ type: [Number], default: [] })
  claimedStreakMilestones: number[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserStatsSchema = SchemaFactory.createForClass(UserStats);

// Indexes
UserStatsSchema.index({ userId: 1 }, { unique: true });
UserStatsSchema.index({ xp: -1 }); // For leaderboards
UserStatsSchema.index({ streakCount: -1 }); // For streak leaderboards
UserStatsSchema.index({ weeklyXP: -1 }); // For weekly leaderboards
UserStatsSchema.index({ allTimeXP: -1 }); // For all-time leaderboards
UserStatsSchema.index({ currentLeague: 1, weeklyXP: -1 }); // For league rankings
UserStatsSchema.index({ lastActiveAt: 1 }); // For activity queries
