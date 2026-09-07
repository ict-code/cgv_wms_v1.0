import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ReceivingsService } from './receivings.service.js';
import { CreateReceivingDto } from './dto/create-receiving.dto.js';
import { ReceivingsQueryDto } from './dto/receivings-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const CAN_RECEIVE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];

@ApiBearerAuth()
@ApiTags('receivings')
@Controller('receivings')
export class ReceivingsController {
  constructor(private readonly service: ReceivingsService) {}

  @Get()
  findAll(@Query() query: ReceivingsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_RECEIVE)
  @Post()
  create(@Body() dto: CreateReceivingDto) {
    return this.service.create(dto);
  }

  @Roles(...CAN_RECEIVE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Client-generated UUID; retried requests with the same key replay the first response instead of posting twice.' })
  @Post(':id/receive')
  receive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.receive(id, user.sub);
  }

  @Roles(...CAN_RECEIVE)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
