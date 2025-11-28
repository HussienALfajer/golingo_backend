/**
 * Notification Schema
 * MongoDB schema for user notifications (progress, achievements, unlocks)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { EntityType } from '../../../common/enums/entity-type.enum';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, type: String })
  message: string;

  @Prop({ enum: EntityType })
  relatedEntityType?: EntityType;

  @Prop({ type: Types.ObjectId })
  relatedEntityId?: Types.ObjectId;

  @Prop({ required: true, type: Boolean, default: false })
  read: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
