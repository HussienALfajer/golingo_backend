/**
 * Video Schema
 * MongoDB schema for videos within categories
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

/**
 * Attachment interface for video media files
 */
export interface VideoAttachment {
  name: string;
  type: string;
  url: string;
  key: string;
}

@Schema({ timestamps: true, collection: 'videos' })
export class Video {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, type: Number, default: 0 })
  order: number;

  @Prop({ type: String })
  videoUrl?: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: String })
  videoStorageKey?: string;

  @Prop({ required: true, type: String })
  backblazeFolderPath: string;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        type: { type: String, required: true },
        url: { type: String, required: true },
        key: { type: String, required: true },
      },
    ],
    default: [],
  })
  attachments: VideoAttachment[];

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);

// Indexes
VideoSchema.index({ categoryId: 1, order: 1 });
VideoSchema.index({ categoryId: 1, isActive: 1 });
VideoSchema.index({ deletedAt: 1 });
