/**
 * Quest Controller
 * Controller for daily quest endpoints
 */

import {
  Controller,
  Get,
  Post,
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
import { QuestService } from '../services/quest.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';

@ApiTags('Quests')
@Controller('me/quests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Get()
  @ApiOperation({ summary: 'Get user active daily quests' })
  @ApiResponse({
    status: 200,
    description: 'Daily quests retrieved successfully',
  })
  async getQuests(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();

    // Ensure user has active quests
    let quests = await this.questService.getUserQuests(userId);
    if (quests.length === 0) {
      // Generate new quests if none exist
      quests = await this.questService.generateDailyQuests(userId);
    }

    return quests.map((q) => ({
      id: q._id,
      questType: q.questType,
      title: q.title,
      description: q.description,
      iconUrl: q.iconUrl,
      target: q.target,
      progress: q.progress,
      reward: q.reward,
      status: q.status,
      expiresAt: q.expiresAt,
      completedAt: q.completedAt,
      claimedAt: q.claimedAt,
    }));
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim quest reward' })
  @ApiParam({ name: 'id', description: 'Quest ID' })
  @ApiResponse({
    status: 200,
    description: 'Quest reward claimed successfully',
  })
  async claimQuest(
    @Param('id', ParseMongoIdPipe) questId: string,
    @CurrentUser() user: UserDocument,
  ) {
    const userId = (user._id as any).toString();
    const result = await this.questService.claimQuestReward(userId, questId);

    return {
      quest: {
        id: result.quest._id,
        questType: result.quest.questType,
        title: result.quest.title,
        reward: result.quest.reward,
        claimedAt: result.quest.claimedAt,
      },
      stats: {
        gems: result.stats.gems,
      },
    };
  }
}

