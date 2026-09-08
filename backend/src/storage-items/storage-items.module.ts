import { Module } from '@nestjs/common';
import { StorageItemsService } from './storage-items.service.js';
import { StorageItemsController } from './storage-items.controller.js';

@Module({
  controllers: [StorageItemsController],
  providers: [StorageItemsService],
  exports: [StorageItemsService],
})
export class StorageItemsModule {}
