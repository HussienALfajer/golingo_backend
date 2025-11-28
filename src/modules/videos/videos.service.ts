/**
 * Videos Service
 * Service for managing videos within categories
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from './schemas/video.schema';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { Level, LevelDocument } from '../levels/schemas/level.schema';
import { MediaService } from '../media/media.service';

@Injectable()
export class VideosService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Level.name) private levelModel: Model<LevelDocument>,
    private mediaService: MediaService,
  ) {}

  /**
   * Create a new video
   */
  async create(createVideoDto: CreateVideoDto): Promise<VideoDocument> {
    // Validate that the category exists
    const category = await this.categoryModel
      .findOne({ _id: createVideoDto.categoryId, deletedAt: null })
      .exec();
    if (!category) {
      throw new BadRequestException(
        'Category with the provided categoryId does not exist in the database',
      );
    }

    // Get the level to build folder path
    const level = await this.levelModel
      .findOne({ _id: category.levelId, deletedAt: null })
      .exec();
    if (!level) {
      throw new BadRequestException(
        'Level associated with this category does not exist',
      );
    }

    // Check if video with same order in this category already exists
    const existingVideo = await this.videoModel
      .findOne({
        categoryId: createVideoDto.categoryId,
        order: createVideoDto.order,
        deletedAt: null,
      })
      .exec();

    if (existingVideo) {
      throw new ConflictException(
        'Video with this order already exists in this category',
      );
    }

    // Use category's backblaze folder path (videos are stored directly in category folder)
    const folderPath = category.backblazeFolderPath;

    // Update the DTO with the folder path
    const videoData = {
      ...createVideoDto,
      backblazeFolderPath: folderPath,
    };

    const video = new this.videoModel(videoData);
    return video.save();
  }

  /**
   * Upload video file
   */
  async uploadVideo(
    videoId: string,
    file: Express.Multer.File,
  ): Promise<VideoDocument> {
    const video = await this.findOne(videoId);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Upload video to category's videos folder
    const uploadResult = await this.mediaService.uploadFile(
      file,
      video.backblazeFolderPath,
      'videos',
    );

    // Update video with video storage key
    video.videoStorageKey = uploadResult.key;
    video.videoUrl = uploadResult.url;

    return video.save();
  }

  /**
   * Sanitize folder name to be filesystem-safe
   */
  private sanitizeFolderName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Find all videos for a specific category
   */
  async findByCategory(categoryId: string): Promise<VideoDocument[]> {
    return this.videoModel
      .find({ categoryId, deletedAt: null, isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Find all videos (admin view)
   */
  async findAll(): Promise<VideoDocument[]> {
    return this.videoModel
      .find({ deletedAt: null })
      .sort({ categoryId: 1, order: 1 })
      .exec();
  }

  /**
   * Find video by ID
   */
  async findOne(id: string): Promise<VideoDocument> {
    const video = await this.videoModel
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  /**
   * Update video
   */
  async update(
    id: string,
    updateVideoDto: UpdateVideoDto,
  ): Promise<VideoDocument> {
    const video = await this.videoModel
      .findByIdAndUpdate(id, updateVideoDto, { new: true })
      .exec();
    if (!video || video.deletedAt) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  /**
   * Soft delete video
   */
  async remove(id: string): Promise<void> {
    const video = await this.videoModel
      .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
      .exec();
    if (!video) {
      throw new NotFoundException('Video not found');
    }
  }
}
