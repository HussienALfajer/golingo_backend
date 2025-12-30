/**
 * Media Service
 * Service for managing media files on Backblaze B2
 */

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

// AWS SDK - dynamically imported
type AWS = any;
type S3 = any;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private s3: S3 | null = null;
  private bucket: string;
  private baseUrl: string;
  private AWS: AWS | null = null;
  private provider: string;
  private region: string;
  private endpoint: string | null = null;

  constructor(private configService: ConfigService) {
    const provider = this.configService.get<string>('storage.provider') ?? 's3';

    this.bucket =
      this.configService.get<string>('storage.bucket')?.trim() ?? 'sign-language-media';
    this.baseUrl = this.configService.get<string>('storage.baseUrl')?.trim() ?? '';

    // Validate bucket name
    if (!this.bucket) {
      this.logger.warn(
        'Storage bucket name is not configured. Object storage will be disabled.',
      );
      return;
    }

    try {
      this.AWS = require('aws-sdk');
    } catch (error) {
      this.logger.warn(
        'AWS SDK not available. Object storage service will be disabled.',
      );
      return;
    }

    const accessKeyId =
      this.configService.get<string>('storage.accessKeyId') ??
      this.configService.get<string>('storage.awsAccessKeyId') ??
      '';
    const secretAccessKey =
      this.configService.get<string>('storage.secretAccessKey') ??
      this.configService.get<string>('storage.awsSecretAccessKey') ??
      '';
    const region =
      this.configService.get<string>('storage.region') ??
      this.configService.get<string>('storage.awsRegion') ??
      'us-east-1';
    const endpoint =
      this.configService.get<string>('storage.endpoint') ??
      this.configService.get<string>('storage.s3Endpoint') ??
      '';

    // Validate credentials - check for empty strings too
    if (!accessKeyId?.trim() || !secretAccessKey?.trim()) {
      this.logger.warn(
        'Storage credentials are not configured or are empty. Object storage will be disabled.',
      );
      this.logger.debug(
        `Storage config check - AccessKeyId: ${accessKeyId ? 'SET' : 'MISSING'} (length: ${accessKeyId?.length || 0}), SecretAccessKey: ${secretAccessKey ? 'SET' : 'MISSING'} (length: ${secretAccessKey?.length || 0})`,
      );
      return;
    }

    if (provider === 's3' || provider === 'backblaze') {
      this.provider = provider;
      // Sensible defaults for Backblaze B2 if envs are missing
      const resolvedRegion =
        provider === 'backblaze' && (!region || region === 'us-east-1')
          ? 'us-east-005'
          : region;
      
      // For Backblaze B2, ensure endpoint is properly formatted
      let resolvedEndpoint: string | undefined = undefined;
      if (provider === 'backblaze') {
        if (endpoint?.trim()) {
          // Use provided endpoint, ensure it doesn't have trailing slash
          resolvedEndpoint = endpoint.trim().replace(/\/$/, '');
        } else {
          // Default endpoint based on region
          const b2Region = resolvedRegion || 'us-east-005';
          resolvedEndpoint = `https://s3.${b2Region}.backblazeb2.com`;
        }
      } else if (endpoint?.trim()) {
        // For AWS S3, use provided endpoint
        resolvedEndpoint = endpoint.trim().replace(/\/$/, '');
      }

      this.region = resolvedRegion;
      this.endpoint = resolvedEndpoint || null;

      // Validate that region is set (required for S3)
      if (!this.region) {
        this.logger.warn(
          'Storage region is not configured. Object storage will be disabled.',
        );
        return;
      }

      this.s3 = new this.AWS.S3({
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        region: this.region,
        endpoint: this.endpoint || undefined,
        signatureVersion: 'v4',
        s3ForcePathStyle: true,
      });

      // Log configuration (masking secrets)
      const maskedAccessKey = accessKeyId.trim().substring(0, 4) + '***' + accessKeyId.trim().substring(accessKeyId.trim().length - 4);
      this.logger.log(
        provider === 'backblaze'
          ? `Backblaze B2 (S3-compatible) storage initialized - Bucket: ${this.bucket}, Region: ${this.region}, Endpoint: ${this.endpoint || 'default'}, AccessKey: ${maskedAccessKey}`
          : `AWS S3 storage initialized - Bucket: ${this.bucket}, Region: ${this.region}, AccessKey: ${maskedAccessKey}`,
      );

      // Test connection by attempting to head the bucket (non-destructive test)
      this.testConnection().catch((error) => {
        this.logger.warn(
          `S3 connection test failed: ${error.message}. This may indicate credential or permission issues.`,
        );
      });
    } else {
      this.logger.warn(
        `Unknown storage provider: ${provider}. Object storage will be disabled.`,
      );
    }
  }

  /**
   * Create a folder for a level in Backblaze
   */
  async createLevelFolder(folderPath: string): Promise<string> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    try {
      // In S3/B2, folders are created implicitly by creating objects with trailing slashes
      const folderKey = this.ensureTrailingSlash(folderPath);

      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: folderKey,
          Body: '',
        })
        .promise();

      this.logger.log(`Level folder created successfully: ${folderKey}`);
      return folderKey;
    } catch (error: any) {
      this.logger.error(
        `Failed to create level folder: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to create level folder: ${error.message}`,
      );
    }
  }

  /**
   * Create a folder for a category inside a level folder
   */
  async createCategoryFolder(folderPath: string): Promise<string> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    try {
      // Ensure folder path has trailing slash
      const folderKey = this.ensureTrailingSlash(folderPath);

      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: folderKey,
          Body: '',
        })
        .promise();

      // Create subfolders (videos, images, files, quizzes)
      const subfolders = ['videos/', 'images/', 'files/', 'quizzes/'];
      for (const subfolder of subfolders) {
        const subfolderKey = folderKey + subfolder;
        await this.s3
          .putObject({
            Bucket: this.bucket,
            Key: subfolderKey,
            Body: '',
          })
          .promise();
      }

      this.logger.log(`Category folder created successfully: ${folderKey}`);
      return folderKey;
    } catch (error: any) {
      this.logger.error(
        `Failed to create category folder: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to create category folder: ${error.message}`,
      );
    }
  }

  /**
   * Upload a file to Backblaze B2
   */
  async uploadFile(
    file: Express.Multer.File,
    folderPath: string,
    subfolder: 'videos' | 'images' | 'files' | 'quizzes' = 'files',
  ): Promise<{ url: string; key: string; size: number; contentType: string }> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      // Generate unique filename
      const fileExtension = extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;

      // Ensure folder path has trailing slash
      const folderKey = this.ensureTrailingSlash(folderPath);
      const fileKey = `${folderKey}${subfolder}/${fileName}`;

      // Upload file
      // Note: Backblaze B2 doesn't support canned ACL like 'public-read'
      // File visibility is controlled at the bucket level
      const params: any = {
        Bucket: this.bucket,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        // No ACL here; rely on bucket-level permissions (public/private)
      };

      await this.s3.putObject(params).promise();

      // Construct URL
      let url: string;

      if (this.baseUrl) {
        // Prefer a configured base URL (Backblaze friendly URL or CDN)
        url = `${this.baseUrl}/${fileKey}`;
      } else if (this.provider === 'backblaze') {
        url = `https://${this.bucket}.s3.${this.region}.backblazeb2.com/${fileKey}`;
      } else {
        // Default AWS S3 URL
        url = `https://${this.bucket}.s3.amazonaws.com/${fileKey}`;
      }

      this.logger.log(`File uploaded successfully: ${fileKey}`);

      return {
        url,
        key: fileKey,
        size: file.size,
        contentType: file.mimetype,
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload file: ${error.message}`, error);
      
      // Provide specific guidance for 403 Forbidden errors
      if (error.code === 'Forbidden' || error.statusCode === 403) {
        const errorDetails = [
          'S3 Access Forbidden (403). Possible causes:',
          `1. Invalid credentials - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY`,
          `2. Wrong bucket name - Current: ${this.bucket}`,
          `3. Insufficient permissions - Application key needs writeFiles permission`,
          `4. Wrong endpoint - Current: ${this.endpoint || 'default'}`,
          `5. Wrong region - Current: ${this.region}`,
        ].join('\n');
        
        this.logger.error(errorDetails);
        throw new InternalServerErrorException(
          `S3 Access Forbidden. Please verify your credentials, bucket name (${this.bucket}), and application key permissions.`,
        );
      }
      
      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a file from Backblaze B2
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    try {
      const params: any = {
        Bucket: this.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete file: ${error.message}`, error);
      throw new InternalServerErrorException(
        `Failed to delete file: ${error.message}`,
      );
    }
  }

  /**
   * Get a signed URL for temporary access (download)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    try {
      const params: any = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrlPromise('getObject', params);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate signed URL: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.s3) {
      return false;
    }

    try {
      await this.s3.headObject({ Bucket: this.bucket, Key: key }).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    if (!this.s3) {
      throw new Error('Object storage is not configured');
    }

    try {
      return await this.s3
        .headObject({ Bucket: this.bucket, Key: key })
        .promise();
    } catch (error: any) {
      this.logger.error(`Failed to get file metadata: ${error.message}`, error);
      throw new InternalServerErrorException(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }

  /**
   * Check if a folder exists in storage
   */
  async folderExists(folderPath: string): Promise<boolean> {
    if (!this.s3) {
      return false;
    }

    try {
      const normalizedPath = this.ensureTrailingSlash(folderPath);

      // Check if any file exists in the folder path
      const result = await this.s3
        .listObjectsV2({
          Bucket: this.bucket,
          Prefix: normalizedPath,
          MaxKeys: 1,
        })
        .promise();

      return (result.Contents?.length ?? 0) > 0;
    } catch (error: any) {
      this.logger.error(
        `Failed to check folder existence: ${error.message}`,
        error,
      );
      return false;
    }
  }

  /**
   * Test S3 connection by attempting to list buckets or head bucket
   */
  private async testConnection(): Promise<void> {
    if (!this.s3) {
      return;
    }

    try {
      // Try to list buckets first (tests basic credentials)
      await this.s3.listBuckets().promise();
      this.logger.log('S3 connection test successful - credentials are valid');
    } catch (error: any) {
      // If listBuckets fails, try headBucket (tests bucket-specific access)
      try {
        await this.s3.headBucket({ Bucket: this.bucket }).promise();
        this.logger.log(
          `S3 connection test successful - bucket '${this.bucket}' is accessible`,
        );
      } catch (headError: any) {
        if (headError.code === 'Forbidden' || headError.statusCode === 403) {
          this.logger.error(
            `S3 connection test failed with 403 Forbidden. This usually means:
1. Application Key doesn't have 'listBuckets' or 'readFiles' capability
2. Application Key is restricted to a different bucket
3. Bucket name '${this.bucket}' doesn't match the key's allowed buckets
Please check your Backblaze B2 Application Key permissions.`,
          );
        } else {
          this.logger.warn(
            `S3 connection test failed: ${headError.message || error.message}`,
          );
        }
        // Don't throw - this is just a test, service can still be used
      }
    }
  }

  /**
   * Ensure folder path has trailing slash
   */
  private ensureTrailingSlash(path: string): string {
    return path.endsWith('/') ? path : `${path}/`;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }
}
