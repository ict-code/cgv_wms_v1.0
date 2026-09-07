import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { InventoryController } from './inventory.controller.js';
import { TransactionsController } from './transactions.controller.js';

@Module({
  controllers: [InventoryController, TransactionsController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
