/**
 * Milestone Controller
 * Controller for streak milestone endpoints
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MilestoneService } from '../services/milestone.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';

@ApiTags('Milestones')
@Controller('me/milestones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available streak milestones' })
  @ApiResponse({
    status: 200,
    description: 'All milestones retrieved successfully',
  })
  async getAllMilestones() {
    const milestones = await this.milestoneService.getAllMilestones();
    return {
      milestones: milestones.map((m) => ({
        day: m.day,
        title: m.title,
        description: m.description,
        celebrationMessage: m.celebrationMessage,
        icon: m.icon,
        reward: m.reward,
      })),
    };
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get user milestone progress' })
  @ApiResponse({
    status: 200,
    description: 'Milestone progress retrieved successfully',
  })
  async getMilestoneProgress(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const progress = await this.milestoneService.getMilestoneProgress(userId);

    return {
      currentStreak: progress.currentStreak,
      claimedMilestones: progress.claimedMilestones,
      nextMilestone: progress.nextMilestone
        ? {
            day: progress.nextMilestone.day,
            title: progress.nextMilestone.title,
            description: progress.nextMilestone.description,
            icon: progress.nextMilestone.icon,
            reward: progress.nextMilestone.reward,
            daysRemaining: progress.nextMilestone.day - progress.currentStreak,
          }
        : null,
      claimableMilestones: progress.claimableMilestones.map((m) => ({
        day: m.day,
        title: m.title,
        description: m.description,
        celebrationMessage: m.celebrationMessage,
        icon: m.icon,
        reward: m.reward,
      })),
    };
  }

  @Get('claimable')
  @ApiOperation({ summary: 'Get milestones available for claiming' })
  @ApiResponse({
    status: 200,
    description: 'Claimable milestones retrieved successfully',
  })
  async getClaimableMilestones(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const milestones =
      await this.milestoneService.getClaimableMilestones(userId);

    return {
      claimable: milestones.map((m) => ({
        day: m.day,
        title: m.title,
        description: m.description,
        celebrationMessage: m.celebrationMessage,
        icon: m.icon,
        reward: m.reward,
      })),
    };
  }

  @Post('claim/:day')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a streak milestone reward' })
  @ApiParam({ name: 'day', description: 'The milestone day to claim (e.g., 3, 7, 14, 30)', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Milestone claimed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid milestone day or already claimed',
  })
  @ApiResponse({
    status: 404,
    description: 'Milestone not found or not eligible',
  })
  async claimMilestone(
    @Param('day') day: string,
    @CurrentUser() user: UserDocument,
  ) {
    const dayNumber = parseInt(day, 10);
    if (isNaN(dayNumber) || dayNumber <= 0) {
      throw new BadRequestException('Invalid milestone day');
    }

    const userId = (user._id as any).toString();
    const result = await this.milestoneService.claimMilestone(
      userId,
      dayNumber,
    );

    if (!result) {
      throw new NotFoundException(
        'Milestone not found, already claimed, or streak requirement not met',
      );
    }

    return {
      success: true,
      milestone: {
        day: result.milestone.day,
        title: result.milestone.title,
        celebrationMessage: result.milestone.celebrationMessage,
        icon: result.milestone.icon,
      },
      rewards: {
        gemsAwarded: result.gemsAwarded,
        xpBoostApplied: result.xpBoostApplied,
        xpBoostDetails: result.xpBoostApplied
          ? {
              multiplier: result.reward.xpBoostMultiplier,
              durationMinutes: result.reward.xpBoostDurationMinutes,
            }
          : null,
        streakFreezeAwarded: result.streakFreezeAwarded,
        specialBadge: result.reward.specialBadge || null,
      },
    };
  }
}
