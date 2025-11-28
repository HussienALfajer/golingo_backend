/**
 * Shop Controller
 * Controller for shop endpoints
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ShopService } from './shop.service';
import { PurchaseDto } from './dto/purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Shop')
@Controller('shop')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  @ApiOperation({ summary: 'Get all available shop items' })
  @ApiResponse({
    status: 200,
    description: 'Shop items retrieved successfully',
  })
  async getItems() {
    const items = await this.shopService.getAllItems();
    return items.map((item) => ({
      id: item._id,
      code: item.code,
      type: item.type,
      name: item.name,
      description: item.description,
      iconUrl: item.iconUrl,
      priceGems: item.priceGems,
      effectConfig: item.effectConfig,
      stockLimit: item.stockLimit,
    }));
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purchase a shop item' })
  @ApiResponse({ status: 200, description: 'Item purchased successfully' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient gems or item out of stock',
  })
  async purchase(
    @Body() purchaseDto: PurchaseDto,
    @CurrentUser() user: UserDocument,
  ) {
    const result = await this.shopService.purchaseItem(
      (user._id as any).toString(),
      purchaseDto,
    );
    return {
      purchase: {
        id: result.purchase._id,
        shopItemId: result.purchase.shopItemId,
        gemsSpent: result.purchase.gemsSpent,
        metadata: result.purchase.metadata,
        createdAt: result.purchase.createdAt,
      },
      stats: {
        xp: result.stats.xp,
        energy: result.stats.energy,
        gems: result.stats.gems,
        streakCount: result.stats.streakCount,
      },
    };
  }
}
