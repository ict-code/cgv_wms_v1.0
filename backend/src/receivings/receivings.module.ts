import { Module } from '@nestjs/common';
import { ReceivingsService } from './receivings.service.js';
import { ReceivingsController } from './receivings.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [ReceivingsController],
  providers: [ReceivingsService, IdempotencyInterceptor],
})
export class ReceivingsModule {}
