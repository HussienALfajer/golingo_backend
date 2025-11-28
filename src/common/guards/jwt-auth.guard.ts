/**
 * JWT Auth Guard
 * Guard to protect routes requiring authentication
 * Includes token blacklist checking for proper logout support
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Inject(AuthService) private authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked as public to bypass authentication
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Validate Authorization header format before attempting authentication
    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers?.authorization;

    // Check if Authorization header is missing
    if (!authorizationHeader) {
      throw new UnauthorizedException(
        'Authorization header is missing. Please provide a valid JWT token.',
      );
    }

    // Check if token format is correct (Bearer token) - case insensitive check
    const authHeaderLower = authorizationHeader.toLowerCase();
    if (!authHeaderLower.startsWith('bearer ')) {
      throw new UnauthorizedException(
        'Invalid token format. Please use: Authorization: Bearer <token>',
      );
    }

    // Extract the token
    const token = authorizationHeader.substring(7); // Remove "bearer " or "Bearer " (7 chars)

    // Check if token is blacklisted
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException(
        'Token has been revoked. Please login again.',
      );
    }

    // Normalize the header to "Bearer " (capital B) for Passport compatibility
    request.headers.authorization = `Bearer ${token}`;

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Handle specific JWT errors
    if (info) {
      if (info.name === 'TokenExpiredError') {
        const expiredAt = info.expiredAt
          ? new Date(info.expiredAt * 1000).toISOString()
          : 'unknown';
        throw new UnauthorizedException(
          `Token has expired at ${expiredAt}. Please login again to get a new token.`,
        );
      }
      if (info.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(
          `Invalid token: ${info.message || 'Please provide a valid JWT token.'}`,
        );
      }
      if (info.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet.');
      }
      // Handle any other JWT errors
      throw new UnauthorizedException(
        `Authentication failed: ${info.message || info.name}`,
      );
    }

    // Handle other errors
    if (err) {
      throw err;
    }

    // Check if user exists
    if (!user) {
      throw new UnauthorizedException('User not found or token is invalid.');
    }

    return user;
  }
}
