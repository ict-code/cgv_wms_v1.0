import { Module } from '@nestjs/common';
import { IssuancesService } from './issuances.service.js';
import { IssuancesController } from './issuances.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [IssuancesController],
  providers: [IssuancesService, IdempotencyInterceptor],
})
export class IssuancesModule {}
