/**
 * Categories Service
 * Service for managing categories within levels
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MediaService } from '../media/media.service';
import { Level, LevelDocument } from '../levels/schemas/level.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Level.name) private levelModel: Model<LevelDocument>,
    private mediaService: MediaService,
  ) {}

  /**
   * Create a new category and initialize its folder in Backblaze
   */
  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    // Validate that the level exists
    const level = await this.levelModel
      .findOne({ _id: createCategoryDto.levelId, deletedAt: null })
      .exec();
    if (!level) {
      throw new BadRequestException(
        'Level with the provided levelId does not exist in the database',
      );
    }

    // Check if category with same order in this level already exists
    const existingCategory = await this.categoryModel
      .findOne({
        levelId: createCategoryDto.levelId,
        order: createCategoryDto.order,
        deletedAt: null,
      })
      .exec();

    if (existingCategory) {
      throw new ConflictException(
        'Category with this order already exists in this level',
      );
    }

    // Generate folder path using real names (sanitize for filesystem)
    const sanitizedLevelName = this.sanitizeFolderName(level.title);
    const sanitizedCategoryName = this.sanitizeFolderName(
      createCategoryDto.title,
    );
    const folderPath = `${level.backblazeFolderPath}/${sanitizedCategoryName}`;

    // Create folder in Backblaze
    try {
      await this.mediaService.createCategoryFolder(folderPath);
    } catch (error) {
      console.error('Error creating category folder:', error);
    }

    // Update the DTO with the generated folder path
    const categoryData = {
      ...createCategoryDto,
      backblazeFolderPath: folderPath,
    };

    const category = new this.categoryModel(categoryData);
    return category.save();
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
   * Find all categories for a specific level
   */
  async findByLevel(levelId: string): Promise<CategoryDocument[]> {
    // Validate and convert levelId string to ObjectId
    if (!Types.ObjectId.isValid(levelId)) {
      throw new BadRequestException('Invalid levelId format');
    }

    const objectId = new Types.ObjectId(levelId);
    return this.categoryModel
      .find({ levelId: objectId, deletedAt: null, isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Find all categories (admin view)
   */
  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ deletedAt: null })
      .sort({ levelId: 1, order: 1 })
      .exec();
  }

  /**
   * Find category by ID
   */
  async findOne(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /**
   * Update category
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .exec();
    if (!category || category.deletedAt) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /**
   * Soft delete category
   */
  async remove(id: string): Promise<void> {
    const category = await this.categoryModel
      .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
      .exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }
}
