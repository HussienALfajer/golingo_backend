/**
 * Category Schema
 * MongoDB schema for categories within levels
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'Level', required: true })
  levelId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  code: string; // e.g. "family", "food", "colors", ...

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, type: Number, default: 0 })
  order: number;

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ required: true, type: String })
  backblazeFolderPath: string;

  @Prop({ type: Date })
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Indexes
CategorySchema.index({ levelId: 1, code: 1 }, { unique: true });
CategorySchema.index({ levelId: 1, order: 1 });
CategorySchema.index({ levelId: 1, isActive: 1 });
CategorySchema.index({ deletedAt: 1 });
