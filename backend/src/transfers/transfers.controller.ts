import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransfersQueryDto } from './dto/transfers-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { RequireModule } from '../common/decorators/require-module.decorator.js';

const CAN_REQUEST = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];
const CAN_APPROVE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER];
const CAN_EXECUTE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];

@ApiBearerAuth()
@ApiTags('transfers')
@RequireModule('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  findAll(@Query() query: TransfersQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_REQUEST)
  @Post()
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Roles(...CAN_APPROVE)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Roles(...CAN_EXECUTE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Client-generated UUID; retried requests with the same key replay the first response instead of posting twice.' })
  @Post(':id/execute')
  execute(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.execute(id, user.sub);
  }

  @Roles(...CAN_APPROVE)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
