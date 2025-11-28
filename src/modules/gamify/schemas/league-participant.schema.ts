/**
 * League Participant Schema
 * MongoDB schema for user participation in league sessions
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeagueParticipantDocument = LeagueParticipant & Document;

@Schema({ timestamps: true, collection: 'league_participants' })
export class LeagueParticipant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'LeagueSession', required: true })
  leagueSessionId: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  weeklyXP: number;

  @Prop({ type: Number, default: 0, min: 0 })
  rank: number; // Current rank in league (1-based)

  @Prop({ type: Boolean, default: false })
  promoted: boolean;

  @Prop({ type: Boolean, default: false })
  demoted: boolean;

  @Prop({ type: Date })
  joinedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LeagueParticipantSchema =
  SchemaFactory.createForClass(LeagueParticipant);

// Indexes
LeagueParticipantSchema.index({ userId: 1, leagueSessionId: 1 }, { unique: true });
LeagueParticipantSchema.index({ leagueSessionId: 1, rank: 1 });
LeagueParticipantSchema.index({ leagueSessionId: 1, weeklyXP: -1 });
LeagueParticipantSchema.index({ userId: 1, createdAt: -1 });

