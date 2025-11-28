/**
 * Current User Decorator
 * Custom decorator to extract the current authenticated user from the request
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Type assertion for Mongoose document with _id
  },
);
