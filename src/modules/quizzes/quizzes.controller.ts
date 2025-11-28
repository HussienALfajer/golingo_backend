/**
 * Quizzes Controller
 * Controller for quiz management and submission endpoints
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProgressService } from '../progress/progress.service';
import { QuizType } from '../../common/enums/quiz-type.enum';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly progressService: ProgressService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new quiz (Admin only)' })
  @ApiResponse({ status: 201, description: 'Quiz successfully created' })
  async create(@Body() createQuizDto: CreateQuizDto) {
    return this.quizzesService.create(createQuizDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all quizzes (paginated)' })
  @ApiResponse({ status: 200, description: 'List of quizzes' })
  async findAll(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('includeQuestions') includeQuestions?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const includeQuestionsFlag = includeQuestions === 'true';

    // For listing, don't enrich URLs to reduce payload size
    // Users can get individual quiz with full details including signed URLs
    return this.quizzesService.findAll(
      limitNum,
      skipNum,
      includeQuestionsFlag,
      false,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('category/:categoryId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get category final quiz by category ID' })
  @ApiResponse({ status: 200, description: 'Category final quiz' })
  @ApiResponse({ status: 404, description: 'Quiz not found for this category' })
  async findByCategory(@Param('categoryId') categoryId: string) {
    const quiz = await this.quizzesService.findByCategory(categoryId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found for this category');
    }
    return quiz;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/attempts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all attempts for a quiz' })
  @ApiResponse({ status: 200, description: 'List of quiz attempts' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  async getQuizAttempts(@Param('id') quizId: string) {
    // Verify quiz exists
    await this.quizzesService.findOne(quizId);
    return this.quizzesService.getQuizAttempts(quizId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/best-score')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get best score for a quiz (across all users)' })
  @ApiResponse({ status: 200, description: 'Best score for the quiz' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  async getQuizBestScore(@Param('id') quizId: string) {
    // Verify quiz exists
    await this.quizzesService.findOne(quizId);
    const bestScore = await this.quizzesService.getBestScoreForQuiz(quizId);
    return { quizId, bestScore };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quiz by ID' })
  @ApiResponse({ status: 200, description: 'Quiz details' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  async findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit quiz answers (Learner only)' })
  @ApiResponse({ status: 201, description: 'Quiz submitted successfully' })
  async submit(
    @Body() submitQuizDto: SubmitQuizDto,
    @CurrentUser() user: UserDocument,
  ) {
    // Submit quiz
    const attempt = await this.quizzesService.submitQuiz(
      (user._id as any).toString(),
      submitQuizDto,
    );

    // Get quiz details
    const quiz = await this.quizzesService.findOne(submitQuizDto.quizId);

    // Update progress based on quiz type (only category final quizzes now)
    if (quiz.type === QuizType.CATEGORY_FINAL && quiz.categoryId) {
      await this.progressService.updateCategoryProgressAfterQuiz(
        (user._id as any).toString(),
        quiz.categoryId.toString(),
      );
    }

    return attempt;
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId/attempts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user attempts (optionally filtered by quiz ID)' })
  @ApiResponse({ status: 200, description: 'List of quiz attempts' })
  async getUserAttempts(
    @Param('userId') userId: string,
    @Query('quizId') quizId?: string,
  ) {
    if (quizId) {
      // If quizId provided, return attempts for that specific quiz
      return this.quizzesService.getUserAttempts(quizId, userId);
    } else {
      // If no quizId, return all attempts for the user across all quizzes
      return this.quizzesService.getAllUserAttempts(userId);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId/best-score')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get best score for a user (optionally filtered by quiz ID)' })
  @ApiResponse({ status: 200, description: 'Best score' })
  async getBestScore(
    @Param('userId') userId: string,
    @Query('quizId') quizId?: string,
  ) {
    if (quizId) {
      // If quizId provided, return best score for that specific quiz
      const score = await this.quizzesService.getBestScore(quizId, userId);
      return { quizId, userId, bestScore: score };
    } else {
      // If no quizId, return best score across all quizzes for the user
      const score = await this.quizzesService.getBestScoreAcrossAllQuizzes(userId);
      return { userId, bestScore: score };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('category/:categoryId/generate')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Generate or update category final quiz from WLASL lessons (Admin only)',
  })
  @ApiResponse({ status: 201, description: 'Quiz generated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({
    status: 400,
    description: 'No lessons found for this category',
  })
  async generateCategoryQuiz(@Param('categoryId') categoryId: string) {
    const quiz =
      await this.quizzesService.generateCategoryFinalQuizFromLessons(
        categoryId,
      );
    return { success: true, data: quiz };
  }
}
