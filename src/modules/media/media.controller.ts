/**
 * Media Controller
 * Controller for media upload endpoints (admin only)
 */

import {
  Controller,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Body,
  Get,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Media (Admin)')
@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('levels/:levelId/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to level folder' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folderPath: {
          type: 'string',
          example: 'levels/level-1',
        },
        subfolder: {
          type: 'string',
          enum: ['videos', 'images', 'files', 'quizzes'],
          default: 'files',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadToLevel(
    @Param('levelId') levelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('folderPath') folderPath: string,
    @Body('subfolder')
    subfolder: 'videos' | 'images' | 'files' | 'quizzes' = 'files',
  ) {
    return this.mediaService.uploadFile(file, folderPath, subfolder);
  }

  @Post('levels/:levelId/categories/:categoryId/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to category folder' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        subfolder: {
          type: 'string',
          enum: ['videos', 'images', 'files', 'quizzes'],
          default: 'files',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadToCategory(
    @Param('levelId') levelId: string,
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('subfolder')
    subfolder: 'videos' | 'images' | 'files' | 'quizzes' = 'files',
  ) {
    // Construct folder path from level and category IDs
    const folderPath = `levels/${levelId}/categories/${categoryId}`;
    return this.mediaService.uploadFile(file, folderPath, subfolder);
  }

  @Delete('files/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete file from storage' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('key') key: string) {
    // Decode the key (in case it's URL-encoded)
    const decodedKey = decodeURIComponent(key);
    await this.mediaService.deleteFile(decodedKey);
  }

  @Get('url')
  @Roles(UserRole.ADMIN, UserRole.LEARNER)
  @ApiOperation({
    summary: 'Get a signed URL for temporary file access (download)',
  })
  @ApiQuery({
    name: 'key',
    description: 'File key/path in storage',
    required: true,
  })
  @ApiQuery({
    name: 'expiresIn',
    description: 'Expiration time in seconds (default: 3600)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getSignedUrl(
    @Query('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    if (!key) {
      throw new BadRequestException('Key parameter is required');
    }
    try {
      // Decode URL-encoded key (handles slashes and special characters)
      const decodedKey = decodeURIComponent(key);
      const expires = expiresIn ? parseInt(expiresIn, 10) : 3600; // Default 1 hour
      const url = await this.mediaService.getSignedUrl(decodedKey, expires);

      return {
        success: true,
        data: {
          url,
          expiresIn: expires,
        },
      };
    } catch (error: any) {
      throw new NotFoundException(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
  }

  @Get('metadata')
  @Roles(UserRole.ADMIN, UserRole.LEARNER)
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiQuery({
    name: 'key',
    description: 'File key/path in storage',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileMetadata(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('Key parameter is required');
    }
    try {
      // Decode URL-encoded key (handles slashes and special characters)
      const decodedKey = decodeURIComponent(key);
      const metadata = await this.mediaService.getFileMetadata(decodedKey);
      return {
        success: true,
        data: metadata,
      };
    } catch (error: any) {
      throw new NotFoundException(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }

  @Get('exists')
  @Roles(UserRole.ADMIN, UserRole.LEARNER)
  @ApiOperation({ summary: 'Check if a file exists' })
  @ApiQuery({
    name: 'key',
    description: 'File key/path in storage',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'File existence checked' })
  async fileExists(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('Key parameter is required');
    }
    // Decode URL-encoded key (handles slashes and special characters)
    const decodedKey = decodeURIComponent(key);
    const exists = await this.mediaService.fileExists(decodedKey);
    return {
      success: true,
      data: {
        exists,
        key: decodedKey,
      },
    };
  }

  @Get('folder/exists')
  @Roles(UserRole.ADMIN, UserRole.LEARNER)
  @ApiOperation({ summary: 'Check if a folder exists' })
  @ApiQuery({
    name: 'path',
    description: 'Folder path in storage',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Folder existence checked' })
  async folderExists(@Query('path') path: string) {
    if (!path) {
      throw new BadRequestException('Path parameter is required');
    }
    // Decode URL-encoded path (handles slashes and special characters)
    const decodedPath = decodeURIComponent(path);
    const exists = await this.mediaService.folderExists(decodedPath);
    return {
      success: true,
      data: {
        exists,
        path: decodedPath,
      },
    };
  }
}
