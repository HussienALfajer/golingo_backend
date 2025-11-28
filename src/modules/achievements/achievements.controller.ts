/**
 * Achievements Controller
 * Controller for achievements endpoints
 */

import {
  Controller,
  Get,
  UseGuards,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active achievements' })
  @ApiResponse({ status: 200, description: 'List of all achievements' })
  async findAll() {
    return this.achievementsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user achievements' })
  @ApiResponse({ status: 200, description: 'List of user achievements' })
  async getUserAchievements(@CurrentUser() user: UserDocument) {
    return this.achievementsService.getUserAchievements(
      (user._id as any).toString(),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get achievement by ID' })
  @ApiResponse({ status: 200, description: 'Achievement details' })
  @ApiResponse({ status: 404, description: 'Achievement not found' })
  async findOne(@Param('id') id: string) {
    return this.achievementsService.findOne(id);
  }
}
