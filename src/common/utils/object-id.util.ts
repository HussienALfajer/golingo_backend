/**
 * ObjectId Utility
 * Consistent ObjectId handling to prevent type mismatches in MongoDB queries
 */

import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

/**
 * Converts a string to ObjectId, throwing BadRequestException if invalid
 */
export function toObjectId(
  id: string | Types.ObjectId,
  fieldName: string = 'id',
): Types.ObjectId {
  if (id instanceof Types.ObjectId) {
    return id;
  }

  if (typeof id !== 'string') {
    throw new BadRequestException(`Invalid ${fieldName}: expected string or ObjectId`);
  }

  const trimmedId = id.trim();
  if (!Types.ObjectId.isValid(trimmedId)) {
    throw new BadRequestException(`Invalid ${fieldName}: not a valid ObjectId`);
  }

  return new Types.ObjectId(trimmedId);
}

/**
 * Safely converts to ObjectId, returning null if invalid (for optional fields)
 */
export function toObjectIdOrNull(
  id: string | Types.ObjectId | undefined | null,
): Types.ObjectId | null {
  if (!id) return null;

  if (id instanceof Types.ObjectId) {
    return id;
  }

  if (typeof id !== 'string') {
    return null;
  }

  const trimmedId = id.trim();
  if (!Types.ObjectId.isValid(trimmedId)) {
    return null;
  }

  return new Types.ObjectId(trimmedId);
}

/**
 * Converts ObjectId to string safely
 */
export function objectIdToString(id: Types.ObjectId | string | any): string {
  if (!id) return '';

  if (typeof id === 'string') {
    return id;
  }

  if (id instanceof Types.ObjectId) {
    return id.toString();
  }

  // Handle mongoose document id
  if (id._id) {
    return objectIdToString(id._id);
  }

  // Fallback: try toString
  if (typeof id.toString === 'function') {
    return id.toString();
  }

  return String(id);
}

/**
 * Compare two ObjectIds or strings for equality
 */
export function objectIdEquals(
  id1: Types.ObjectId | string | any,
  id2: Types.ObjectId | string | any,
): boolean {
  const str1 = objectIdToString(id1);
  const str2 = objectIdToString(id2);
  return str1 === str2;
}

/**
 * Check if a value is a valid ObjectId string or ObjectId instance
 */
export function isValidObjectId(id: any): boolean {
  if (!id) return false;

  if (id instanceof Types.ObjectId) return true;

  if (typeof id === 'string') {
    return Types.ObjectId.isValid(id.trim());
  }

  return false;
}
