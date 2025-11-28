/**
 * Levels Service
 * Service for managing learning levels
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Level, LevelDocument } from './schemas/level.schema';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { MediaService } from '../media/media.service';

@Injectable()
export class LevelsService {
  constructor(
    @InjectModel(Level.name) private levelModel: Model<LevelDocument>,
    private mediaService: MediaService,
  ) {}

  /**
   * Create a new level and initialize its folder in Backblaze
   */
  async create(createLevelDto: CreateLevelDto): Promise<LevelDocument> {
    // Check if level with same order already exists
    const existingLevel = await this.levelModel
      .findOne({ order: createLevelDto.order, deletedAt: null })
      .exec();
    if (existingLevel) {
      throw new ConflictException('Level with this order already exists');
    }

    // Create folder in Backblaze
    try {
      await this.mediaService.createLevelFolder(
        createLevelDto.backblazeFolderPath,
      );
    } catch (error) {
      // Log error but continue (folder might already exist)
      console.error('Error creating level folder:', error);
    }

    const level = new this.levelModel(createLevelDto);
    return level.save();
  }

  /**
   * Find all levels (excluding soft-deleted)
   */
  async findAll(): Promise<LevelDocument[]> {
    return this.levelModel.find({ deletedAt: null }).sort({ order: 1 }).exec();
  }

  /**
   * Find active levels only
   */
  async findActive(): Promise<LevelDocument[]> {
    return this.levelModel
      .find({ isActive: true, deletedAt: null })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Find level by ID
   */
  async findOne(id: string): Promise<LevelDocument> {
    const level = await this.levelModel
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!level) {
      throw new NotFoundException('Level not found');
    }
    return level;
  }

  /**
   * Update level
   */
  async update(
    id: string,
    updateLevelDto: UpdateLevelDto,
  ): Promise<LevelDocument> {
    const level = await this.levelModel
      .findByIdAndUpdate(id, updateLevelDto, { new: true })
      .exec();
    if (!level || level.deletedAt) {
      throw new NotFoundException('Level not found');
    }
    return level;
  }

  /**
   * Soft delete level
   */
  async remove(id: string): Promise<void> {
    const level = await this.levelModel
      .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
      .exec();
    if (!level) {
      throw new NotFoundException('Level not found');
    }
  }

  /**
   * Reorder levels
   */
  async reorder(levelIds: string[]): Promise<LevelDocument[]> {
    const updates = levelIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order: index },
      },
    }));

    await this.levelModel.bulkWrite(updates);
    return this.findAll();
  }
}
