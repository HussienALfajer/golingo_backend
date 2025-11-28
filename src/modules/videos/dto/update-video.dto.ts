/**
 * Update Video DTO
 * Data transfer object for updating a video
 */

import { PartialType } from '@nestjs/swagger';
import { CreateVideoDto } from './create-video.dto';

export class UpdateVideoDto extends PartialType(CreateVideoDto) {}
