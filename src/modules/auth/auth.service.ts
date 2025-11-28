/**
 * Auth Service
 * Service handling authentication logic (registration, login, token refresh, logout)
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { ProgressService } from '../progress/progress.service';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  TokenBlacklist,
  TokenBlacklistDocument,
} from './schemas/token-blacklist.schema';
import {
  LoginAttempt,
  LoginAttemptDocument,
} from './schemas/login-attempt.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import * as crypto from 'crypto';

// Security configuration constants
const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(TokenBlacklist.name)
    private tokenBlacklistModel: Model<TokenBlacklistDocument>,
    @InjectModel(LoginAttempt.name)
    private loginAttemptModel: Model<LoginAttemptDocument>,
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  /**
   * Register a new user (learner or admin)
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.userModel
      .findOne({ email: registerDto.email.toLowerCase() })
      .exec();
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, SALT_ROUNDS);

    // Create user
    const user = new this.userModel({
      ...registerDto,
      email: registerDto.email.toLowerCase(),
      passwordHash,
      role: registerDto.role || UserRole.LEARNER,
    });

    await user.save();

    // Initialize progress for new learners
    if (user.role === UserRole.LEARNER) {
      try {
        await this.progressService.initializeProgressForNewLearner(
          (user._id as any).toString(),
        );
      } catch (error) {
        this.logger.error(
          `Error initializing progress for new learner: ${error.message}`,
          error.stack,
        );
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.transformUser(user),
    };
  }

  /**
   * Login user with email and password
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const email = loginDto.email.toLowerCase();

    // Check for account lockout
    await this.checkAccountLockout(email, ipAddress);

    // Find user by email
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      await this.recordLoginAttempt(email, ipAddress, userAgent, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.recordLoginAttempt(email, ipAddress, userAgent, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Record successful login and clear failed attempts
    await this.recordLoginAttempt(email, ipAddress, userAgent, true);

    // Update last active timestamp
    user.lastActiveAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.transformUser(user),
    };
  }

  /**
   * Check if account is locked due to too many failed attempts
   */
  private async checkAccountLockout(
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    const lockoutWindow = new Date(
      Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );

    // Check failed attempts by email
    const failedAttempts = await this.loginAttemptModel
      .countDocuments({
        email,
        successful: false,
        createdAt: { $gte: lockoutWindow },
      })
      .exec();

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const remainingMinutes = Math.ceil(
        (lockoutWindow.getTime() +
          LOCKOUT_DURATION_MINUTES * 60 * 1000 -
          Date.now()) /
          60000,
      );
      throw new ForbiddenException(
        `Account temporarily locked due to too many failed login attempts. Please try again in ${Math.max(1, remainingMinutes)} minutes.`,
      );
    }

    // Also check by IP to prevent distributed attacks
    if (ipAddress) {
      const ipFailedAttempts = await this.loginAttemptModel
        .countDocuments({
          ipAddress,
          successful: false,
          createdAt: { $gte: lockoutWindow },
        })
        .exec();

      if (ipFailedAttempts >= MAX_FAILED_ATTEMPTS * 2) {
        // More lenient for IP
        throw new ForbiddenException(
          'Too many failed login attempts from this IP address. Please try again later.',
        );
      }
    }
  }

  /**
   * Record a login attempt (successful or failed)
   */
  private async recordLoginAttempt(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    successful: boolean = false,
  ): Promise<void> {
    try {
      await this.loginAttemptModel.create({
        email,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        successful,
      });

      // If successful, clear recent failed attempts for this email
      if (successful) {
        await this.loginAttemptModel
          .deleteMany({
            email,
            successful: false,
          })
          .exec();
      }
    } catch (error) {
      this.logger.error(`Error recording login attempt: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
    user: UserDocument,
  ): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Verify refresh token
    try {
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Blacklist the old refresh token (token rotation)
    await this.blacklistToken(
      refreshToken,
      (user._id as any).toString(),
      'refresh',
    );

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.transformUser(user),
    };
  }

  /**
   * Logout user by blacklisting their tokens
   */
  async logout(
    accessToken: string,
    refreshToken: string | undefined,
    userId: string,
  ): Promise<{ message: string }> {
    // Blacklist access token
    if (accessToken) {
      await this.blacklistToken(accessToken, userId, 'access');
    }

    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.blacklistToken(refreshToken, userId, 'refresh');
    }

    return { message: 'Logout successful' };
  }

  /**
   * Blacklist a token
   */
  private async blacklistToken(
    token: string,
    userId: string,
    tokenType: 'access' | 'refresh',
  ): Promise<void> {
    try {
      // Decode token to get expiration
      const decoded = this.jwtService.decode(token) as { exp: number } | null;
      if (!decoded?.exp) {
        return;
      }

      const expiresAt = new Date(decoded.exp * 1000);

      // Only blacklist if not already expired
      if (expiresAt > new Date()) {
        await this.tokenBlacklistModel
          .findOneAndUpdate(
            { token },
            { token, userId, expiresAt, tokenType },
            { upsert: true },
          )
          .exec();
      }
    } catch (error) {
      this.logger.error(`Error blacklisting token: ${error.message}`);
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistedToken = await this.tokenBlacklistModel
      .findOne({ token })
      .exec();
    return !!blacklistedToken;
  }

  /**
   * Generate access and refresh tokens for a user
   */
  private async generateTokens(
    user: UserDocument,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    };

    // Get expiration times and ensure they're in the correct format
    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.expiresIn');
    const refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    );

    // Convert expiration time to proper format
    const formatExpiresIn = (expiresIn: string): string | number => {
      const numValue = parseInt(expiresIn, 10);
      if (!isNaN(numValue) && expiresIn === numValue.toString()) {
        return numValue;
      }
      return expiresIn;
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: formatExpiresIn(accessTokenExpiresIn || '1d'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: formatExpiresIn(refreshTokenExpiresIn || '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Transform user document to response DTO
   */
  private transformUser(user: UserDocument): UserResponseDto {
    return {
      id: (user._id as any).toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      age: user.age,
      avatar: user.avatar,
    };
  }

  /**
   * Validate password (for password updates)
   */
  async validatePassword(
    user: UserDocument,
    password: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Get failed login attempts count for an email (useful for frontend feedback)
   */
  async getFailedAttemptsCount(email: string): Promise<number> {
    const lockoutWindow = new Date(
      Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );

    return this.loginAttemptModel
      .countDocuments({
        email: email.toLowerCase(),
        successful: false,
        createdAt: { $gte: lockoutWindow },
      })
      .exec();
  }

  /**
   * Request password reset - generates a token and returns it
   * In production, this would send an email instead of returning the token
   */
  async requestPasswordReset(
    email: string,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();

    // Always return success message to prevent email enumeration
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${email}`);
      return { message: successMessage };
    }

    // Invalidate any existing reset tokens for this user
    await this.passwordResetTokenModel
      .updateMany({ userId: user._id, used: false }, { $set: { used: true } })
      .exec();

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Create password reset token document
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.passwordResetTokenModel.create({
      userId: user._id,
      token: hashedToken,
      expiresAt,
      used: false,
    });

    this.logger.log(`Password reset token created for user: ${user._id}`);

    // In development, return the token. In production, send via email
    const isDevelopment =
      this.configService.get<string>('app.env') === 'development';

    return {
      message: successMessage,
      // Only return token in development mode for testing
      ...(isDevelopment && { resetToken }),
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Hash the provided token to match stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find valid, unused token
    const resetToken = await this.passwordResetTokenModel
      .findOne({
        token: hashedToken,
        used: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!resetToken) {
      throw new BadRequestException(
        'Invalid or expired password reset token. Please request a new one.',
      );
    }

    // Find user
    const user = await this.userModel.findById(resetToken.userId).exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordHash = passwordHash;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    // Invalidate all existing tokens for this user (logout from all devices)
    await this.tokenBlacklistModel
      .deleteMany({ userId: (user._id as any).toString() })
      .exec();

    this.logger.log(`Password reset successful for user: ${user._id}`);

    return { message: 'Password has been reset successfully. Please login with your new password.' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordHash = passwordHash;
    await user.save();

    this.logger.log(`Password changed for user: ${userId}`);

    return { message: 'Password has been changed successfully.' };
  }
}
