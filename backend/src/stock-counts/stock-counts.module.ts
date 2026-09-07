import { Module } from '@nestjs/common';
import { StockCountsService } from './stock-counts.service.js';
import { StockCountsController } from './stock-counts.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [StockCountsController],
  providers: [StockCountsService, IdempotencyInterceptor],
})
export class StockCountsModule {}
