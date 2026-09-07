import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { StockCountsService } from './stock-counts.service.js';
import { CreateStockCountDto } from './dto/create-stock-count.dto.js';
import { SubmitStockCountDto } from './dto/submit-stock-count.dto.js';
import { StockCountsQueryDto } from './dto/stock-counts-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const CAN_COUNT = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF, AppRole.INVENTORY_CONTROLLER];
const CAN_REVIEW = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.INVENTORY_CONTROLLER];
const CAN_APPROVE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER];

@ApiBearerAuth()
@ApiTags('stock-counts')
@Controller('stock-counts')
export class StockCountsController {
  constructor(private readonly service: StockCountsService) {}

  @Get()
  findAll(@Query() query: StockCountsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_COUNT)
  @Post()
  create(@Body() dto: CreateStockCountDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Roles(...CAN_COUNT)
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Roles(...CAN_COUNT)
  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitStockCountDto) {
    return this.service.submit(id, dto);
  }

  @Roles(...CAN_REVIEW)
  @Post(':id/review')
  review(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.review(id, user.sub);
  }

  @Roles(...CAN_APPROVE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Client-generated UUID; retried requests with the same key replay the first response instead of posting twice.' })
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Roles(...CAN_APPROVE)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
