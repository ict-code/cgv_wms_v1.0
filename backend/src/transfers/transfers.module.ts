import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersController } from './transfers.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [TransfersController],
  providers: [TransfersService, IdempotencyInterceptor],
})
export class TransfersModule {}
