/**
 * Levels Controller
 * Controller for level management endpoints (admin only)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { LevelsService } from './levels.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Levels (Admin)')
@Controller('admin/levels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new level' })
  @ApiResponse({ status: 201, description: 'Level successfully created' })
  async create(@Body() createLevelDto: CreateLevelDto) {
    return this.levelsService.create(createLevelDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all levels' })
  @ApiResponse({ status: 200, description: 'List of all levels' })
  async findAll() {
    return this.levelsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get level by ID' })
  @ApiResponse({ status: 200, description: 'Level details' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async findOne(@Param('id') id: string) {
    return this.levelsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update level' })
  @ApiResponse({ status: 200, description: 'Level successfully updated' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async update(
    @Param('id') id: string,
    @Body() updateLevelDto: UpdateLevelDto,
  ) {
    return this.levelsService.update(id, updateLevelDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete level (soft delete)' })
  @ApiResponse({ status: 204, description: 'Level successfully deleted' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async remove(@Param('id') id: string) {
    return this.levelsService.remove(id);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder levels' })
  @ApiResponse({ status: 200, description: 'Levels successfully reordered' })
  async reorder(@Body() body: { levelIds: string[] }) {
    return this.levelsService.reorder(body.levelIds);
  }
}
