/**
 * Mastery Controller
 * Controller for skill mastery endpoints
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParseMongoIdPipe } from '../../../common/pipes/parse-mongoid.pipe';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MasteryService } from '../services/mastery.service';
import { PracticeSkillDto } from '../dto/practice-skill.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';

@ApiTags('Mastery')
@Controller('me/mastery')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MasteryController {
  constructor(private readonly masteryService: MasteryService) {}

  @Get()
  @ApiOperation({ summary: 'Get user skill mastery overview' })
  @ApiResponse({
    status: 200,
    description: 'Mastery overview retrieved successfully',
  })
  async getMasteryOverview(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const overview = await this.masteryService.getUserMasteryOverview(userId);

    return {
      totalCrowns: overview.totalCrowns,
      skillsMastered: overview.skillsMastered,
      legendarySkills: overview.legendarySkills,
      totalSkills: overview.totalSkills,
      skillsByLevel: overview.skillsByLevel,
      recentProgress: overview.recentProgress.map((p) => ({
        skillId: p.skillId,
        crownLevel: p.crownLevel,
        totalXP: p.totalXP,
        isLegendary: p.isLegendary,
        lastPracticedAt: p.lastPracticedAt,
      })),
    };
  }

  @Get(':skillId')
  @ApiOperation({ summary: 'Get skill progress' })
  @ApiParam({ name: 'skillId', description: 'Skill (Category) ID' })
  @ApiResponse({
    status: 200,
    description: 'Skill progress retrieved successfully',
  })
  async getSkillProgress(
    @Param('skillId', ParseMongoIdPipe) skillId: string,
    @CurrentUser() user: UserDocument,
  ) {
    const userId = (user._id as any).toString();
    const progress = await this.masteryService.getSkillProgress(userId, skillId);

    return {
      skillId: progress.skillId,
      crownLevel: progress.crownLevel,
      currentXP: progress.currentXP,
      xpToNextCrown: progress.xpToNextCrown,
      totalXP: progress.totalXP,
      mistakeCount: progress.mistakeCount,
      practiceCount: progress.practiceCount,
      isLegendary: progress.isLegendary,
      legendaryAttempts: progress.legendaryAttempts,
      lastPracticedAt: progress.lastPracticedAt,
      firstCrownAt: progress.firstCrownAt,
      lastCrownAt: progress.lastCrownAt,
      canUnlockLegendary: await this.masteryService.canUnlockLegendary(
        userId,
        skillId,
      ),
    };
  }

  @Post(':skillId/practice')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Practice skill to earn hearts' })
  @ApiParam({ name: 'skillId', description: 'Skill (Category) ID' })
  @ApiResponse({
    status: 200,
    description: 'Practice session completed',
  })
  async practiceSkill(
    @Param('skillId', ParseMongoIdPipe) skillId: string,
    @Body() practiceDto: PracticeSkillDto,
    @CurrentUser() user: UserDocument,
  ) {
    const userId = (user._id as any).toString();
    const result = await this.masteryService.practiceSkill(
      userId,
      skillId,
      practiceDto.xpGained,
      practiceDto.mistakes,
    );

    return {
      progress: {
        skillId: result.progress.skillId,
        crownLevel: result.progress.crownLevel,
        currentXP: result.progress.currentXP,
        xpToNextCrown: result.progress.xpToNextCrown,
        totalXP: result.progress.totalXP,
      },
      leveledUp: result.leveledUp,
      newCrownLevel: result.newCrownLevel,
    };
  }
}

