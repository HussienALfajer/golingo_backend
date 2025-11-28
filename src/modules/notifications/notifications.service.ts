/**
 * Notifications Service
 * Service for managing user notifications
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { EntityType } from '../../common/enums/entity-type.enum';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: EntityType;
  relatedEntityId?: any;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * Create a new notification
   */
  async create(
    createDto: CreateNotificationDto,
  ): Promise<NotificationDocument> {
    const notification = new this.notificationModel(createDto);
    return notification.save();
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(
    userId: string,
    unreadOnly: boolean = false,
  ): Promise<NotificationDocument[]> {
    const query: any = { userId };
    if (unreadOnly) {
      query.read = false;
    }

    return this.notificationModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true, readAt: new Date() },
        { new: true },
      )
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ userId, read: false }, { read: true, readAt: new Date() })
      .exec();
  }

  /**
   * Delete notification
   */
  async remove(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationModel
      .findOneAndDelete({ _id: notificationId, userId })
      .exec();
    if (!result) {
      throw new NotFoundException('Notification not found');
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, read: false })
      .exec();
  }
}
