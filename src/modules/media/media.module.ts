/**
 * Media Module
 * Module for media file management (Backblaze B2)
 */

import { Module, forwardRef } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
