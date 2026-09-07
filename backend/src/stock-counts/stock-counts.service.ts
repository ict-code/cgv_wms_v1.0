import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { CreateStockCountDto } from './dto/create-stock-count.dto.js';
import type { SubmitStockCountDto } from './dto/submit-stock-count.dto.js';
import type { StockCountsQueryDto } from './dto/stock-counts-query.dto.js';

@Injectable()
export class StockCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: StockCountsQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockCount.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { warehouse: true, location: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockCount.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const stockCount = await this.prisma.stockCount.findUnique({
      where: { id },
      include: { warehouse: true, location: true, items: { include: { item: true } } },
    });
    if (!stockCount) throw new NotFoundException('Stock count not found');
    return stockCount;
  }

  async create(dto: CreateStockCountDto, userId: string) {
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.itemIds } } });
    if (items.length !== dto.itemIds.length) throw new BadRequestException('One or more items not found');

    return this.prisma.$transaction(async (tx) => {
      const [{ no: countNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('CNT', 'seq_count_no') as no
      `;
      return tx.stockCount.create({
        data: {
          countNo,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          initiatedBy: userId,
          remarks: dto.remarks,
          status: 'DRAFT',
          items: {
            create: dto.itemIds.map((itemId) => ({
              itemId,
              systemQuantity: 0,
              physicalQuantity: 0,
              variance: 0,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async start(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.findUnique({ where: { id }, include: { items: true } });
      if (!stockCount) throw new NotFoundException('Stock count not found');
      if (stockCount.status !== 'DRAFT') {
        throw new BadRequestException(`Cannot start a stock count in status ${stockCount.status}`);
      }

      for (const line of stockCount.items) {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            itemId_warehouseId_locationId: {
              itemId: line.itemId,
              warehouseId: stockCount.warehouseId,
              locationId: stockCount.locationId,
            },
          },
        });
        const systemQuantity = balance?.quantity ?? new Prisma.Decimal(0);
        await tx.stockCountItem.update({
          where: { id: line.id },
          data: { systemQuantity, physicalQuantity: systemQuantity, variance: 0 },
        });
      }

      return tx.stockCount.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
        include: { items: true },
      });
    });
  }

  async submit(id: string, dto: SubmitStockCountDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.findUnique({ where: { id }, include: { items: true } });
      if (!stockCount) throw new NotFoundException('Stock count not found');
      if (stockCount.status !== 'IN_PROGRESS') {
        throw new BadRequestException(`Cannot submit a stock count in status ${stockCount.status}`);
      }

      for (const line of dto.items) {
        const item = stockCount.items.find((i) => i.id === line.stockCountItemId);
        if (!item) throw new BadRequestException(`Stock count item ${line.stockCountItemId} not found on this count`);
        const physicalQuantity = new Prisma.Decimal(line.physicalQuantity);
        const variance = physicalQuantity.minus(item.systemQuantity);
        await tx.stockCountItem.update({
          where: { id: item.id },
          data: { physicalQuantity, variance, remarks: line.remarks },
        });
      }

      return tx.stockCount.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: { items: true },
      });
    });

    if (result.items.some((line) => !line.variance.isZero())) {
      await this.notificationsService.notifyRole(
        AppRole.WAREHOUSE_MANAGER,
        'STOCK_COUNT_DISCREPANCY',
        'Stock count discrepancy',
        `Stock count ${result.countNo} has variances awaiting review.`,
        { entityType: 'stockCount', entityId: result.id, referenceNo: result.countNo },
      );
    }

    return result;
  }

  async review(id: string, userId: string) {
    const stockCount = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!stockCount) throw new NotFoundException('Stock count not found');
    if (stockCount.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot review a stock count in status ${stockCount.status}`);
    }
    return this.prisma.stockCount.update({ where: { id }, data: { status: 'REVIEWED', reviewedBy: userId } });
  }

  async approve(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.findUnique({ where: { id }, include: { items: true } });
      if (!stockCount) throw new NotFoundException('Stock count not found');
      if (stockCount.status !== 'REVIEWED') {
        throw new BadRequestException(`Cannot approve a stock count in status ${stockCount.status}`);
      }

      for (const line of stockCount.items) {
        if (line.variance.isZero()) continue;
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });

        await this.inventoryService.postMovement(tx, {
          transactionType: 'STOCK_COUNT',
          itemId: line.itemId,
          warehouseId: stockCount.warehouseId,
          locationId: stockCount.locationId,
          quantityDelta: line.variance,
          unitCost: item.standardCost,
          referenceType: 'STOCK_COUNT',
          referenceId: stockCount.id,
          performedBy: userId,
          approvedBy: userId,
          remarks: `Stock count ${stockCount.countNo} variance correction`,
        });
      }

      return tx.stockCount.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: userId, completedAt: new Date() },
        include: { items: true },
      });
    });

    for (const line of result.items) {
      if (line.variance.isNegative()) {
        await this.notificationsService.checkLowStock(line.itemId, result.warehouseId);
      }
    }

    return result;
  }

  async cancel(id: string) {
    const stockCount = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!stockCount) throw new NotFoundException('Stock count not found');
    if (stockCount.status === 'APPROVED' || stockCount.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a stock count in status ${stockCount.status}`);
    }
    return this.prisma.stockCount.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
