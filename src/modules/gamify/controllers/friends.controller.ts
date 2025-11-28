/**
 * Friends Controller
 * Controller for social features (friends, friend quests)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Friendship,
  FriendshipDocument,
  FriendshipStatus,
} from '../schemas/friendship.schema';
import { FriendQuest, FriendQuestDocument } from '../schemas/friend-quest.schema';
import { AddFriendDto } from '../dto/add-friend.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@ApiTags('Friends')
@Controller('me/friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  constructor(
    @InjectModel(Friendship.name)
    private friendshipModel: Model<FriendshipDocument>,
    @InjectModel(FriendQuest.name)
    private friendQuestModel: Model<FriendQuestDocument>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user friends list' })
  @ApiResponse({
    status: 200,
    description: 'Friends list retrieved successfully',
  })
  async getFriends(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const friendships = await this.friendshipModel
      .find({
        $or: [
          { user1: new Types.ObjectId(userId), status: FriendshipStatus.ACCEPTED },
          { user2: new Types.ObjectId(userId), status: FriendshipStatus.ACCEPTED },
        ],
      })
      .populate('user1', 'username email')
      .populate('user2', 'username email')
      .exec();

    return friendships.map((f) => {
      const friend =
        f.user1.toString() === userId ? f.user2 : f.user1;
      return {
        friendshipId: f._id,
        friendId: (friend as any)._id || friend,
        username: (friend as any)?.username,
        email: (friend as any)?.email,
        acceptedAt: f.acceptedAt,
        createdAt: f.createdAt,
      };
    });
  }

  @Post('add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add friend or accept friend request' })
  @ApiResponse({
    status: 200,
    description: 'Friend request sent or accepted',
  })
  async addFriend(
    @Body() addFriendDto: AddFriendDto,
    @CurrentUser() user: UserDocument,
  ) {
    const userId = (user._id as any).toString();
    const friendId = addFriendDto.friendId;

    if (userId === friendId) {
      throw new BadRequestException('Cannot add yourself as a friend');
    }

    // Check if friendship already exists
    const existing = await this.friendshipModel
      .findOne({
        $or: [
          { user1: new Types.ObjectId(userId), user2: new Types.ObjectId(friendId) },
          { user1: new Types.ObjectId(friendId), user2: new Types.ObjectId(userId) },
        ],
      })
      .exec();

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new BadRequestException('Already friends');
      }
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new BadRequestException('Cannot add blocked user');
      }
      // Accept pending request
      if (
        existing.user2.toString() === userId &&
        existing.status === FriendshipStatus.PENDING
      ) {
        existing.status = FriendshipStatus.ACCEPTED;
        existing.acceptedAt = new Date();
        await existing.save();
        return {
          message: 'Friend request accepted',
          friendship: {
            id: existing._id,
            status: existing.status,
          },
        };
      }
      throw new BadRequestException('Friend request already sent');
    }

    // Create new friendship request
    const friendship = new this.friendshipModel({
      user1: new Types.ObjectId(userId),
      user2: new Types.ObjectId(friendId),
      status: FriendshipStatus.PENDING,
      requestedBy: new Types.ObjectId(userId),
    });

    await friendship.save();

    return {
      message: 'Friend request sent',
      friendship: {
        id: friendship._id,
        status: friendship.status,
      },
    };
  }

  @Get('quests')
  @ApiOperation({ summary: 'Get friend quests (collaborative challenges)' })
  @ApiResponse({
    status: 200,
    description: 'Friend quests retrieved successfully',
  })
  async getFriendQuests(@CurrentUser() user: UserDocument) {
    const userId = (user._id as any).toString();
    const now = new Date();

    const quests = await this.friendQuestModel
      .find({
        $or: [
          { userId: new Types.ObjectId(userId) },
          { friendId: new Types.ObjectId(userId) },
        ],
        expiresAt: { $gt: now },
        status: { $ne: 'expired' },
      })
      .populate('userId', 'username')
      .populate('friendId', 'username')
      .sort({ createdAt: -1 })
      .exec();

    return quests.map((q) => ({
      id: q._id,
      title: q.title,
      description: q.description,
      target: q.target,
      userProgress: q.userProgress,
      friendProgress: q.friendProgress,
      totalProgress: q.totalProgress,
      reward: q.reward,
      status: q.status,
      expiresAt: q.expiresAt,
      userClaimed: q.userClaimed,
      friendClaimed: q.friendClaimed,
      userId: q.userId,
      friendId: q.friendId,
    }));
  }
}

