import { Module } from '@nestjs/common';
import { AdjustmentsService } from './adjustments.service.js';
import { AdjustmentsController } from './adjustments.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [AdjustmentsController],
  providers: [AdjustmentsService, IdempotencyInterceptor],
})
export class AdjustmentsModule {}
