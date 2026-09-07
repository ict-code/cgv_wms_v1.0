import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service.js';
import { ReturnsController } from './returns.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
