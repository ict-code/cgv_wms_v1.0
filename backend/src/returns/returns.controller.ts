import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReturnsService } from './returns.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';
import { ReturnsQueryDto } from './dto/returns-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { RequireModule } from '../common/decorators/require-module.decorator.js';

const CAN_PROCESS = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];

@ApiBearerAuth()
@ApiTags('returns')
@RequireModule('returns')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Get()
  findAll(@Query() query: ReturnsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_PROCESS)
  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.service.create(dto);
  }

  @Roles(...CAN_PROCESS)
  @Post(':id/receive')
  receive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.receive(id, user.sub);
  }

  @Roles(...CAN_PROCESS)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
