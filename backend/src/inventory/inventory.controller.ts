import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { InventoryQueryDto } from './dto/inventory-query.dto.js';

@ApiBearerAuth()
@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: InventoryQueryDto) {
    const where = {
      ...(query.itemId && { itemId: query.itemId }),
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.locationId && { locationId: query.locationId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { item: true, warehouse: true, location: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  @Get('export.xlsx')
  async exportXlsx(@Query() query: InventoryQueryDto, @Res() res: Response) {
    const where = {
      ...(query.itemId && { itemId: query.itemId }),
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.locationId && { locationId: query.locationId }),
    };
    const rows = await this.prisma.inventoryBalance.findMany({
      where,
      include: { item: true, warehouse: true, location: true },
      orderBy: { updatedAt: 'desc' },
    });
    const buffer = await toXlsx(
      'Current Stock',
      ['Item Code', 'Item Name', 'Warehouse', 'Location', 'Quantity', 'Reserved', 'Available'],
      rows.map((r) => [
        r.item.itemCode,
        r.item.name,
        r.warehouse.name,
        r.location.name,
        r.quantity.toString(),
        r.reservedQuantity.toString(),
        r.availableQuantity.toString(),
      ]),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="current-stock.xlsx"');
    res.send(buffer);
  }

  @Get('item/:itemId')
  findByItem(@Param('itemId') itemId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { itemId },
      include: { warehouse: true, location: true },
    });
  }

  @Get('location/:locationId')
  findByLocation(@Param('locationId') locationId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { locationId },
      include: { item: true },
    });
  }

  @Get('warehouse/:warehouseId')
  findByWarehouse(@Param('warehouseId') warehouseId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: { item: true, location: true },
    });
  }

  @Get(':itemId/history')
  async history(@Param('itemId') itemId: string, @Query() pagination: PaginationQueryDto) {
    const where = { itemId };
    const [data, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { location: true, performedByUser: { select: { fullname: true } } },
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const balance = await this.prisma.inventoryBalance.findUnique({
      where: { id },
      include: { item: true, warehouse: true, location: true },
    });
    if (!balance) throw new NotFoundException('Inventory balance not found');
    return balance;
  }
}
