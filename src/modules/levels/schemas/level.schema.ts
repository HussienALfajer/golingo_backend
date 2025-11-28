/**
 * Level Schema
 * MongoDB schema for learning levels (difficulty levels)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LevelDocument = Level & Document;

@Schema({ timestamps: true, collection: 'levels' })
export class Level {
  @Prop({ required: true, trim: true, uppercase: true, unique: true })
  code: string; // e.g. "L1", "L2"

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

export const LevelSchema = SchemaFactory.createForClass(Level);

// Indexes
LevelSchema.index({ code: 1 }, { unique: true });
LevelSchema.index({ order: 1 });
LevelSchema.index({ isActive: 1 });
LevelSchema.index({ deletedAt: 1 });
