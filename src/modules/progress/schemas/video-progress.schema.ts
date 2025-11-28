/**
 * Video Progress Schema
 * MongoDB schema for tracking learner progress through videos
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoProgressDocument = VideoProgress & Document;

@Schema({ timestamps: true, collection: 'video_progress' })
export class VideoProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Video', required: true })
  videoId: Types.ObjectId;

  @Prop({ required: true, type: Boolean, default: false })
  watched: boolean;

  @Prop({ type: Date })
  watchedAt?: Date;

  @Prop({ type: Date })
  unlockedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VideoProgressSchema = SchemaFactory.createForClass(VideoProgress);

// Indexes - unique compound index to ensure one progress record per user-video
VideoProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });
VideoProgressSchema.index({ userId: 1, completedAt: 1 });
