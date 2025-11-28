/**
 * Friend Quest Schema
 * MongoDB schema for collaborative friend challenges
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FriendQuestDocument = FriendQuest & Document;

export enum FriendQuestStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'friend_quests' })
export class FriendQuest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  friendId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, type: Number, min: 1 })
  target: number; // Combined target for both users

  @Prop({ type: Number, default: 0, min: 0 })
  userProgress: number; // User's contribution

  @Prop({ type: Number, default: 0, min: 0 })
  friendProgress: number; // Friend's contribution

  @Prop({ type: Number, default: 0, min: 0 })
  totalProgress: number; // Combined progress

  @Prop({ required: true, type: Number, min: 0 })
  reward: number; // Gem reward for each participant

  @Prop({ required: true, enum: FriendQuestStatus, default: FriendQuestStatus.ACTIVE })
  status: FriendQuestStatus;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Boolean, default: false })
  userClaimed: boolean;

  @Prop({ type: Boolean, default: false })
  friendClaimed: boolean;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FriendQuestSchema = SchemaFactory.createForClass(FriendQuest);

// Indexes
FriendQuestSchema.index({ userId: 1, status: 1, expiresAt: 1 });
FriendQuestSchema.index({ friendId: 1, status: 1, expiresAt: 1 });
FriendQuestSchema.index({ userId: 1, friendId: 1 });
FriendQuestSchema.index({ expiresAt: 1, status: 1 });

