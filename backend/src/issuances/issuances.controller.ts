import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { IssuancesService } from './issuances.service.js';
import { CreateIssuanceDto } from './dto/create-issuance.dto.js';
import { IssueIssuanceDto } from './dto/issue-issuance.dto.js';
import { IssuancesQueryDto } from './dto/issuances-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const CAN_REQUEST = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF, AppRole.REQUESTER];
const CAN_APPROVE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER];
const CAN_ISSUE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];

@ApiBearerAuth()
@ApiTags('issuances')
@Controller('issuances')
export class IssuancesController {
  constructor(private readonly service: IssuancesService) {}

  @Get()
  findAll(@Query() query: IssuancesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_REQUEST)
  @Post()
  create(@Body() dto: CreateIssuanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Roles(...CAN_APPROVE)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Roles(...CAN_ISSUE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Client-generated UUID; retried requests with the same key replay the first response instead of posting twice.' })
  @Post(':id/issue')
  issue(@Param('id') id: string, @Body() dto: IssueIssuanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.issue(id, user.sub, dto);
  }

  @Roles(...CAN_APPROVE)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
