/**
 * League Service
 * Service for managing league system and weekly competitions
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { League, LeagueDocument, LeagueTier } from '../schemas/league.schema';
import {
  LeagueSession,
  LeagueSessionDocument,
} from '../schemas/league-session.schema';
import {
  LeagueParticipant,
  LeagueParticipantDocument,
} from '../schemas/league-participant.schema';
import { UserStats, UserStatsDocument } from '../schemas/user-stats.schema';
import { LeaguePromotedEvent, LeagueDemotedEvent } from '../../../common/events/gamification.events';

@Injectable()
export class LeagueService {
  private readonly LEAGUE_TIERS: LeagueTier[] = [
    LeagueTier.BRONZE,
    LeagueTier.SILVER,
    LeagueTier.GOLD,
    LeagueTier.SAPPHIRE,
    LeagueTier.RUBY,
    LeagueTier.EMERALD,
    LeagueTier.AMETHYST,
    LeagueTier.PEARL,
    LeagueTier.OBSIDIAN,
    LeagueTier.DIAMOND,
  ];

  constructor(
    @InjectModel(League.name)
    private leagueModel: Model<LeagueDocument>,
    @InjectModel(LeagueSession.name)
    private leagueSessionModel: Model<LeagueSessionDocument>,
    @InjectModel(LeagueParticipant.name)
    private leagueParticipantModel: Model<LeagueParticipantDocument>,
    @InjectModel(UserStats.name)
    private userStatsModel: Model<UserStatsDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Initialize default leagues
   */
  async initializeDefaultLeagues(): Promise<void> {
    const defaults = [
      {
        tier: LeagueTier.BRONZE,
        name: 'Bronze League',
        description: 'Start your journey in the Bronze League',
        minXPToPromote: 50,
        maxPromotions: 10,
        demotionThreshold: 25,
        order: 0,
      },
      {
        tier: LeagueTier.SILVER,
        name: 'Silver League',
        description: 'Climb higher in the Silver League',
        minXPToPromote: 100,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 1,
      },
      {
        tier: LeagueTier.GOLD,
        name: 'Gold League',
        description: 'Shine in the Gold League',
        minXPToPromote: 150,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 2,
      },
      {
        tier: LeagueTier.SAPPHIRE,
        name: 'Sapphire League',
        description: 'Excel in the Sapphire League',
        minXPToPromote: 200,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 3,
      },
      {
        tier: LeagueTier.RUBY,
        name: 'Ruby League',
        description: 'Dominate the Ruby League',
        minXPToPromote: 250,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 4,
      },
      {
        tier: LeagueTier.EMERALD,
        name: 'Emerald League',
        description: 'Master the Emerald League',
        minXPToPromote: 300,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 5,
      },
      {
        tier: LeagueTier.AMETHYST,
        name: 'Amethyst League',
        description: 'Conquer the Amethyst League',
        minXPToPromote: 350,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 6,
      },
      {
        tier: LeagueTier.PEARL,
        name: 'Pearl League',
        description: 'Rise in the Pearl League',
        minXPToPromote: 400,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 7,
      },
      {
        tier: LeagueTier.OBSIDIAN,
        name: 'Obsidian League',
        description: 'Elite Obsidian League',
        minXPToPromote: 450,
        maxPromotions: 10,
        demotionThreshold: 20,
        order: 8,
      },
      {
        tier: LeagueTier.DIAMOND,
        name: 'Diamond League',
        description: 'The ultimate Diamond League',
        minXPToPromote: 500,
        maxPromotions: 15, // More promotions in Diamond
        demotionThreshold: 25,
        order: 9,
      },
    ];

    for (const leagueData of defaults) {
      const existing = await this.leagueModel
        .findOne({ tier: leagueData.tier })
        .exec();
      if (!existing) {
        const league = new this.leagueModel(leagueData);
        await league.save();
      }
    }
  }

  /**
   * Get or assign user to a league
   */
  async getOrAssignLeague(userId: string): Promise<LeagueParticipantDocument> {
    // Convert userId to ObjectId to match the schema (userId is stored as ObjectId in user_stats)
    const userObjectId = new Types.ObjectId(userId);
    const userStats = await this.userStatsModel.findOne({ userId: userObjectId }).exec();
    if (!userStats) {
      throw new NotFoundException('User stats not found');
    }

    // Get current active session for user's league
    const currentLeague = userStats.currentLeague || LeagueTier.BRONZE;
    const activeSession = await this.getActiveLeagueSession(currentLeague);

    if (!activeSession) {
      // Create new session if needed
      const newSession = await this.createLeagueSession(currentLeague);
      return this.assignUserToLeague(userId, (newSession._id as any).toString());
    }

    // Check if user is already participating
    let participant: LeagueParticipantDocument | null = await this.leagueParticipantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        leagueSessionId: activeSession._id,
      })
      .exec();

    if (!participant) {
      participant = await this.assignUserToLeague(
        userId,
        (activeSession._id as any).toString(),
      );
      if (!participant) {
        throw new NotFoundException('Failed to assign user to league');
      }
    }

    return participant as LeagueParticipantDocument;
  }

  /**
   * Get active league session for a tier
   */
  async getActiveLeagueSession(
    tier: LeagueTier | string,
  ): Promise<LeagueSessionDocument | null> {
    const now = new Date();
    return this.leagueSessionModel
      .findOne({
        tier,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .exec();
  }

  /**
   * Create a new league session
   */
  async createLeagueSession(
    tier: LeagueTier | string,
  ): Promise<LeagueSessionDocument> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);

    // Reset to Monday if not already Monday
    const dayOfWeek = startDate.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setUTCDate(startDate.getUTCDate() + diff);

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

    const session = new this.leagueSessionModel({
      tier,
      startDate,
      endDate,
      isActive: true,
      participantCount: 0,
    });

    return session.save();
  }

  /**
   * Assign user to a league session
   */
  async assignUserToLeague(
    userId: string,
    leagueSessionId: string,
  ): Promise<LeagueParticipantDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const userStats = await this.userStatsModel.findOne({ userId: userObjectId }).exec();
    if (!userStats) {
      throw new NotFoundException('User stats not found');
    }

    // Get session
    const session = await this.leagueSessionModel
      .findById(leagueSessionId)
      .exec();
    if (!session) {
      throw new NotFoundException('League session not found');
    }

    // Create or update participant
    const participant = await this.leagueParticipantModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          leagueSessionId: new Types.ObjectId(leagueSessionId),
        },
        {
          userId: new Types.ObjectId(userId),
          leagueSessionId: new Types.ObjectId(leagueSessionId),
          weeklyXP: userStats.weeklyXP || 0,
          rank: 0,
          joinedAt: new Date(),
        },
        { upsert: true, new: true },
      )
      .exec();

    // Update user stats
    userStats.currentLeague = session.tier;
    await userStats.save();

    // Update session participant count
    session.participantCount = await this.leagueParticipantModel
      .countDocuments({ leagueSessionId: session._id })
      .exec();
    await session.save();

    // Update rankings
    await this.updateLeagueRankings(leagueSessionId);

    if (!participant) {
      throw new NotFoundException('Failed to create league participant');
    }

    return participant;
  }

  /**
   * Update user's weekly XP and recalculate rankings
   */
  async updateUserWeeklyXP(userId: string, xpGained: number): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const userStats = await this.userStatsModel.findOne({ userId: userObjectId }).exec();
    if (!userStats) {
      return;
    }

    // Update weekly XP
    userStats.weeklyXP = (userStats.weeklyXP || 0) + xpGained;
    userStats.allTimeXP = (userStats.allTimeXP || 0) + xpGained;
    await userStats.save();

    // Update league participant
    const participant = await this.getOrAssignLeague(userId);
    if (participant) {
      participant.weeklyXP = userStats.weeklyXP;
      await participant.save();

      // Update rankings
      if (participant.leagueSessionId) {
        await this.updateLeagueRankings(
          (participant.leagueSessionId as any).toString(),
        );
      }
    }
  }

  /**
   * Update league rankings
   */
  async updateLeagueRankings(leagueSessionId: string): Promise<void> {
    const participants = await this.leagueParticipantModel
      .find({ leagueSessionId: new Types.ObjectId(leagueSessionId) })
      .sort({ weeklyXP: -1, joinedAt: 1 })
      .exec();

    // Update ranks
    for (let i = 0; i < participants.length; i++) {
      participants[i].rank = i + 1;
      await participants[i].save();
    }
  }

  /**
   * Get league leaderboard
   */
  async getLeagueLeaderboard(
    leagueSessionId: string,
    limit: number = 50,
  ): Promise<LeagueParticipantDocument[]> {
    return this.leagueParticipantModel
      .find({ leagueSessionId: new Types.ObjectId(leagueSessionId) })
      .populate('userId', 'username email')
      .sort({ rank: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get user's league status
   */
  async getUserLeagueStatus(
    userId: string,
  ): Promise<{
    participant: LeagueParticipantDocument | null;
    session: LeagueSessionDocument | null;
    league: LeagueDocument | null;
    leaderboard: LeagueParticipantDocument[];
    promotionThreshold: number;
    demotionThreshold: number;
  }> {
    const participant = await this.leagueParticipantModel
      .findOne({
        userId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!participant) {
      return {
        participant: null,
        session: null,
        league: null,
        leaderboard: [],
        promotionThreshold: 0,
        demotionThreshold: 0,
      };
    }

    const session = await this.leagueSessionModel
      .findById(participant.leagueSessionId)
      .exec();

    if (!session) {
      return {
        participant,
        session: null,
        league: null,
        leaderboard: [],
        promotionThreshold: 0,
        demotionThreshold: 0,
      };
    }

    const league = await this.leagueModel
      .findOne({ tier: session.tier })
      .exec();

    const leaderboard = await this.getLeagueLeaderboard(
      (session._id as any).toString(),
      50,
    );

    return {
      participant,
      session,
      league,
      leaderboard,
      promotionThreshold: league?.minXPToPromote || 0,
      demotionThreshold: league?.demotionThreshold || 0,
    };
  }

  /**
   * Process league promotions and demotions (called weekly)
   */
  async processLeagueRotation(): Promise<void> {
    const now = new Date();
    const expiredSessions = await this.leagueSessionModel
      .find({
        endDate: { $lte: now },
        isActive: true,
      })
      .exec();

    for (const session of expiredSessions) {
      // Archive session
      session.isActive = false;
      session.isArchived = true;
      await session.save();

      // Get participants and process promotions/demotions
      const participants = await this.leagueParticipantModel
        .find({ leagueSessionId: session._id })
        .sort({ rank: 1 })
        .exec();

      const league = await this.leagueModel.findOne({ tier: session.tier }).exec();
      if (!league) continue;

      const maxPromotions = league.maxPromotions || 10;
      const demotionThreshold = league.demotionThreshold || 20;

      for (const participant of participants) {
        const userStats = await this.userStatsModel
          .findOne({ userId: participant.userId })
          .exec();

        if (!userStats) continue;

        // Check for promotion
        if (
          participant.rank <= maxPromotions &&
          participant.weeklyXP >= league.minXPToPromote
        ) {
          // Promote to next league
          const currentTierIndex = this.LEAGUE_TIERS.indexOf(session.tier);
          if (currentTierIndex < this.LEAGUE_TIERS.length - 1) {
            const nextTier = this.LEAGUE_TIERS[currentTierIndex + 1];
            userStats.currentLeague = nextTier;
            await userStats.save();

            // Emit promotion event
            this.eventEmitter.emit('league.promoted', {
              userId: participant.userId.toString(),
              fromLeague: session.tier,
              toLeague: nextTier,
              rank: participant.rank,
            } as LeaguePromotedEvent);
          }
        }
        // Check for demotion
        else if (participant.rank > demotionThreshold) {
          // Demote to previous league
          const currentTierIndex = this.LEAGUE_TIERS.indexOf(session.tier);
          if (currentTierIndex > 0) {
            const prevTier = this.LEAGUE_TIERS[currentTierIndex - 1];
            userStats.currentLeague = prevTier;
            await userStats.save();

            // Emit demotion event
            this.eventEmitter.emit('league.demoted', {
              userId: participant.userId.toString(),
              fromLeague: session.tier,
              toLeague: prevTier,
              rank: participant.rank,
            } as LeagueDemotedEvent);
          }
        }

        // Reset weekly XP
        userStats.weeklyXP = 0;
        await userStats.save();
      }

      // Create new session for each tier
      await this.createLeagueSession(session.tier);
    }
  }
}

