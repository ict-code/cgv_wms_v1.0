import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@ApiBearerAuth()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll(@Query() query: NotificationsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.findForUser(user.sub, query);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markRead(id, user.sub);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllRead(user.sub);
  }

  /** No scheduler is wired into this deployment — call this periodically (operator or external cron) to raise EXPIRING_SOON alerts. */
  @Roles(AppRole.ADMINISTRATOR)
  @Post('check-expiring')
  checkExpiring() {
    return this.service.checkExpiringItems();
  }
}
