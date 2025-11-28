/**
 * League Controller
 * Controller for league system endpoints
 */

import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LeagueService } from '../services/league.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';

@ApiTags('League')
@Controller('me/league')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeagueController {
  constructor(private readonly leagueService: LeagueService) {}

  @Get()
  @ApiOperation({ summary: 'Get user league status and leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'League status retrieved successfully',
  })
  async getLeagueStatus(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const status = await this.leagueService.getUserLeagueStatus(userId);

    return {
      participant: status.participant
        ? {
            rank: status.participant.rank,
            weeklyXP: status.participant.weeklyXP,
            promoted: status.participant.promoted,
            demoted: status.participant.demoted,
          }
        : null,
      session: status.session
        ? {
            tier: status.session.tier,
            startDate: status.session.startDate,
            endDate: status.session.endDate,
            participantCount: status.session.participantCount,
          }
        : null,
      league: status.league
        ? {
            tier: status.league.tier,
            name: status.league.name,
            description: status.league.description,
            minXPToPromote: status.league.minXPToPromote,
            demotionThreshold: status.league.demotionThreshold,
          }
        : null,
      leaderboard: status.leaderboard.map((p) => ({
        userId: p.userId,
        username: (p.userId as any)?.username,
        rank: p.rank,
        weeklyXP: p.weeklyXP,
      })),
      promotionThreshold: status.promotionThreshold,
      demotionThreshold: status.demotionThreshold,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user league history' })
  @ApiResponse({
    status: 200,
    description: 'League history retrieved successfully',
  })
  async getLeagueHistory(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    // TODO: Implement league history
    return {
      history: [],
      message: 'League history endpoint - to be implemented',
    };
  }
}

