/**
 * Progress Controller
 * Controller for learner progress endpoints
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Progress')
@Controller('me/progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('levels')
  @ApiOperation({ summary: 'Get all levels progress for current user' })
  @ApiResponse({ status: 200, description: 'List of levels with progress' })
  async getAllLevelsProgress(@CurrentUser() user: UserDocument) {
    return this.progressService.getAllLevelsProgress(
      (user._id as any).toString(),
    );
  }

  @Get('levels/:levelId')
  @ApiOperation({ summary: 'Get level progress by ID' })
  @ApiResponse({ status: 200, description: 'Level progress with categories' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelProgress(
    @Param('levelId') levelId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.progressService.getLevelProgress(
      (user._id as any).toString(),
      levelId,
    );
  }

  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Get category progress by ID' })
  @ApiResponse({ status: 200, description: 'Category progress with videos' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryProgress(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.progressService.getCategoryProgress(
      (user._id as any).toString(),
      categoryId,
    );
  }

  @Post('lessons/:lessonId/videos/:videoId/mark-watched')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a video within a lesson as watched' })
  @ApiResponse({ status: 200, description: 'Video marked as watched' })
  @ApiResponse({ status: 404, description: 'Lesson or video not found' })
  @ApiResponse({ status: 400, description: 'Lesson is locked or video does not belong to lesson' })
  async markLessonVideoWatched(
    @Param('lessonId') lessonId: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.progressService.markLessonVideoWatched(
      (user._id as any).toString(),
      lessonId,
      videoId,
    );
  }
}
