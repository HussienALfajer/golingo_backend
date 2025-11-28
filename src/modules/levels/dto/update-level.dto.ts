/**
 * Update Level DTO
 * Data transfer object for updating a level
 */

import { PartialType } from '@nestjs/swagger';
import { CreateLevelDto } from './create-level.dto';

export class UpdateLevelDto extends PartialType(CreateLevelDto) {}
