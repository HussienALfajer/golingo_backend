/**
 * Purchase Schema
 * MongoDB schema for tracking user purchases from the shop
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PurchaseDocument = Purchase & Document;

@Schema({ timestamps: true, collection: 'purchases' })
export class Purchase {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ShopItem', required: true })
  shopItemId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  gemsSpent: number;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Store effect details, etc.

  createdAt?: Date;
  updatedAt?: Date;
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);

// Indexes
PurchaseSchema.index({ userId: 1, createdAt: -1 });
PurchaseSchema.index({ shopItemId: 1 });
PurchaseSchema.index({ userId: 1, shopItemId: 1 });
