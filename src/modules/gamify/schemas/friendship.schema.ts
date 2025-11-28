/**
 * Friendship Schema
 * MongoDB schema for user friendships
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FriendshipDocument = Friendship & Document;

export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  BLOCKED = 'blocked',
}

@Schema({ timestamps: true, collection: 'friendships' })
export class Friendship {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;

  @Prop({ required: true, enum: FriendshipStatus, default: FriendshipStatus.PENDING })
  status: FriendshipStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  requestedBy?: Types.ObjectId; // Who sent the friend request

  @Prop({ type: Date })
  acceptedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

// Indexes
FriendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });
FriendshipSchema.index({ user2: 1, user1: 1 }); // Reverse lookup
FriendshipSchema.index({ user1: 1, status: 1 });
FriendshipSchema.index({ user2: 1, status: 1 });

