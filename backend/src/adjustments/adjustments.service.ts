import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import type { AdjustmentsQueryDto } from './dto/adjustments-query.dto.js';

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: AdjustmentsQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.adjustment.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adjustment.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const adjustment = await this.prisma.adjustment.findUnique({
      where: { id },
      include: { warehouse: true, items: { include: { item: true, location: true } } },
    });
    if (!adjustment) throw new NotFoundException('Adjustment not found');
    return adjustment;
  }

  async create(dto: CreateAdjustmentDto, userId: string) {
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.items.map((i) => i.itemId) } } });
    for (const line of dto.items) {
      if (!items.find((i) => i.id === line.itemId)) throw new BadRequestException(`Item ${line.itemId} not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [{ no: adjustmentNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('ADJ', 'seq_adjustment_no') as no
      `;
      return tx.adjustment.create({
        data: {
          adjustmentNo,
          warehouseId: dto.warehouseId,
          requestedBy: userId,
          reason: dto.reason,
          remarks: dto.remarks,
          status: 'PENDING_APPROVAL',
          items: {
            create: dto.items.map((line) => ({
              itemId: line.itemId,
              locationId: line.locationId,
              quantity: line.quantity,
              adjustmentType: line.adjustmentType,
              batchNo: line.batchNo,
              serialNo: line.serialNo,
            })),
          },
        },
        include: { items: true },
      });
    });

    await this.notificationsService.notifyRole(
      AppRole.WAREHOUSE_MANAGER,
      'ADJUSTMENT_PENDING_APPROVAL',
      'Adjustment awaiting approval',
      `Adjustment ${result.adjustmentNo} (${result.reason}) needs approval.`,
      { entityType: 'adjustment', entityId: result.id, referenceNo: result.adjustmentNo },
    );

    return result;
  }

  async approve(id: string, userId: string) {
    const adjustment = await this.prisma.adjustment.findUnique({ where: { id } });
    if (!adjustment) throw new NotFoundException('Adjustment not found');
    if (adjustment.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Cannot approve an adjustment in status ${adjustment.status}`);
    }
    return this.prisma.adjustment.update({ where: { id }, data: { status: 'APPROVED', approvedBy: userId } });
  }

  async post(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.adjustment.findUnique({ where: { id }, include: { items: true } });
      if (!adjustment) throw new NotFoundException('Adjustment not found');
      if (adjustment.status !== 'APPROVED') {
        throw new BadRequestException(`Cannot post an adjustment in status ${adjustment.status}`);
      }

      for (const line of adjustment.items) {
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
        const signedQuantity = line.adjustmentType === 'ADJUSTMENT_IN' ? Number(line.quantity) : -Number(line.quantity);

        await this.inventoryService.postMovement(tx, {
          transactionType: line.adjustmentType,
          itemId: line.itemId,
          warehouseId: adjustment.warehouseId,
          locationId: line.locationId,
          quantityDelta: signedQuantity,
          unitCost: item.standardCost,
          referenceType: 'ADJUSTMENT',
          referenceId: adjustment.id,
          batchNo: line.batchNo,
          serialNo: line.serialNo,
          performedBy: userId,
          approvedBy: adjustment.approvedBy,
          remarks: `Adjustment ${adjustment.adjustmentNo} (${adjustment.reason})`,
        });
      }

      return tx.adjustment.update({
        where: { id },
        data: { status: 'POSTED', postedBy: userId },
        include: { items: true },
      });
    });

    for (const line of result.items) {
      if (line.adjustmentType === 'ADJUSTMENT_OUT') {
        await this.notificationsService.checkLowStock(line.itemId, result.warehouseId);
      }
    }

    return result;
  }

  async cancel(id: string) {
    const adjustment = await this.prisma.adjustment.findUnique({ where: { id } });
    if (!adjustment) throw new NotFoundException('Adjustment not found');
    if (adjustment.status === 'POSTED' || adjustment.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel an adjustment in status ${adjustment.status}`);
    }
    return this.prisma.adjustment.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
