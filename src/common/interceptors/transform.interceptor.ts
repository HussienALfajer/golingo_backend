/**
 * Transform Interceptor
 * Global interceptor to transform responses and exclude sensitive fields
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { classToPlain } from 'class-transformer';
import { Document } from 'mongoose';
import { Types } from 'mongoose';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Handle null or undefined
        if (data == null) {
          return data;
        }

        // Handle Mongoose documents - convert to plain object first
        if (this.isMongooseDocument(data)) {
          // Use toJSON if available (respects schema transforms), otherwise toObject
          const plain =
            typeof data.toJSON === 'function'
              ? data.toJSON()
              : data.toObject({ getters: true, virtuals: false });
          return this.serializeObject(plain);
        }

        // Handle arrays of Mongoose documents
        if (Array.isArray(data)) {
          return data.map((item) => {
            if (this.isMongooseDocument(item)) {
              const plain =
                typeof item.toJSON === 'function'
                  ? item.toJSON()
                  : item.toObject({ getters: true, virtuals: false });
              return this.serializeObject(plain);
            }
            return this.serializeObject(item);
          });
        }

        // Check if it's already a plain object (not a class instance)
        // Plain objects have constructor === Object, class instances have custom constructors
        const isPlainObject =
          typeof data === 'object' &&
          data.constructor === Object &&
          Object.getPrototypeOf(data) === Object.prototype;

        // Only use classToPlain for class instances, not plain objects
        // Plain objects go directly to serializeObject to avoid circular reference issues
        if (isPlainObject) {
          return this.serializeObject(data);
        }

        // Handle class instances with classToPlain
        try {
          return this.serializeObject(classToPlain(data));
        } catch (error) {
          // If classToPlain fails (e.g., circular reference), fall back to direct serialization
          return this.serializeObject(data);
        }
      }),
    );
  }

  /**
   * Recursively serialize MongoDB ObjectIds and other special types to strings
   */
  private serializeObject(obj: any): any {
    if (obj == null) {
      return obj;
    }

    // Handle ObjectId instances
    if (obj instanceof Types.ObjectId) {
      return obj.toString();
    }

    // Handle Buffer (ObjectId buffer)
    if (Buffer.isBuffer(obj)) {
      // Check if it's an ObjectId buffer (12 bytes)
      if (obj.length === 12) {
        try {
          return new Types.ObjectId(obj).toString();
        } catch (e) {
          return obj.toString('base64');
        }
      }
      return obj.toString('base64');
    }

    // Handle nested buffer objects (from JSON serialization)
    if (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'Buffer' &&
      Array.isArray(obj.data)
    ) {
      const buffer = Buffer.from(obj.data);
      if (buffer.length === 12) {
        try {
          return new Types.ObjectId(buffer).toString();
        } catch (e) {
          return buffer.toString('base64');
        }
      }
      return buffer.toString('base64');
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeObject(item));
    }

    // Handle plain objects
    if (typeof obj === 'object' && obj.constructor === Object) {
      const serialized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          serialized[key] = this.serializeObject(obj[key]);
        }
      }
      return serialized;
    }

    // Return primitive values as-is
    return obj;
  }

  /**
   * Check if an object is a Mongoose document
   */
  private isMongooseDocument(obj: any): obj is Document {
    if (!obj || typeof obj !== 'object' || typeof obj.toObject !== 'function') {
      return false;
    }

    // Check for Mongoose document indicators
    const hasMongooseIndicators =
      obj.constructor?.name === 'model' ||
      obj.$isMongooseModelPrototype ||
      (obj._id && obj.constructor?.modelName) ||
      obj.__v !== undefined;

    return hasMongooseIndicators;
  }
}
