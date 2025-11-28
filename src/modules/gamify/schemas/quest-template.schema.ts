/**
 * Quest Template Schema
 * MongoDB schema for predefined quest types
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { QuestType } from './daily-quest.schema';

export type QuestTemplateDocument = QuestTemplate & Document;

@Schema({ timestamps: true, collection: 'quest_templates' })
export class QuestTemplate {
  @Prop({ required: true, enum: QuestType, unique: true })
  questType: QuestType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String })
  iconUrl?: string;

  @Prop({ type: Object, default: {} })
  defaultTarget: Record<string, any>; // Default target configuration

  @Prop({ type: Number, default: 10, min: 0 })
  defaultReward: number; // Default gem reward

  @Prop({ type: Number, default: 24, min: 1 })
  defaultExpirationHours: number; // Hours until quest expires

  @Prop({ type: Object, default: {} })
  targetRanges: Record<string, any>; // Min/max ranges for randomization

  @Prop({ type: Number, default: 0, min: 0 })
  priority: number; // Priority for selection (higher = more likely)

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuestTemplateSchema = SchemaFactory.createForClass(QuestTemplate);

// Indexes
QuestTemplateSchema.index({ questType: 1 }, { unique: true });
QuestTemplateSchema.index({ isActive: 1, priority: -1 });

