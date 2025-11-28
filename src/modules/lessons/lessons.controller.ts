import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Get lessons for a category' })
  @ApiResponse({ status: 200, description: 'List of lessons' })
  async getLessonsByCategory(@Param('categoryId') categoryId: string) {
    const data = await this.lessonsService.getLessonsByCategory(categoryId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson details' })
  @ApiResponse({
    status: 200,
    description: 'Lesson details with lesson videos',
  })
  async getLessonDetail(@Param('id') id: string) {
    const data = await this.lessonsService.getLessonDetail(id);
    return { success: true, data };
  }
}
