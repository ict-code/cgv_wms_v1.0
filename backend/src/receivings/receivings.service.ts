import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { CreateReceivingDto } from './dto/create-receiving.dto.js';
import type { ReceivingsQueryDto } from './dto/receivings-query.dto.js';

@Injectable()
export class ReceivingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: ReceivingsQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.receiving.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { supplier: true, warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.receiving.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const receiving = await this.prisma.receiving.findUnique({
      where: { id },
      include: { supplier: true, warehouse: true, items: { include: { item: true, location: true } } },
    });
    if (!receiving) throw new NotFoundException('Receiving not found');
    return receiving;
  }

  async create(dto: CreateReceivingDto) {
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.items.map((i) => i.itemId) } } });
    for (const line of dto.items) {
      const item = items.find((i) => i.id === line.itemId);
      if (!item) throw new BadRequestException(`Item ${line.itemId} not found`);
      if (item.trackBatch && !line.batchNo) throw new BadRequestException(`Item ${item.itemCode} requires a batch number`);
      if (item.trackExpiry && !line.expiryDate) throw new BadRequestException(`Item ${item.itemCode} requires an expiry date`);
      if (item.trackSerial && !line.serialNo) throw new BadRequestException(`Item ${item.itemCode} requires a serial number`);
    }

    return this.prisma.$transaction(async (tx) => {
      const [{ no: receivingNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('RCV', 'seq_receiving_no') as no
      `;
      return tx.receiving.create({
        data: {
          receivingNo,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          purchaseReference: dto.purchaseReference,
          deliveryReference: dto.deliveryReference,
          remarks: dto.remarks,
          status: 'PENDING',
          items: {
            create: dto.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              locationId: line.locationId,
              batchNo: line.batchNo,
              serialNo: line.serialNo,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async receive(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const receiving = await tx.receiving.findUnique({ where: { id }, include: { items: true } });
      if (!receiving) throw new NotFoundException('Receiving not found');
      if (receiving.status !== 'PENDING') {
        throw new BadRequestException(`Cannot post a receiving in status ${receiving.status}`);
      }

      for (const line of receiving.items) {
        await this.inventoryService.postMovement(tx, {
          transactionType: 'RECEIVE',
          itemId: line.itemId,
          warehouseId: receiving.warehouseId,
          locationId: line.locationId,
          quantityDelta: line.quantity,
          unitCost: line.unitCost,
          referenceType: 'RECEIVING',
          referenceId: receiving.id,
          batchNo: line.batchNo,
          serialNo: line.serialNo,
          expiryDate: line.expiryDate,
          performedBy: userId,
          remarks: `Receiving ${receiving.receivingNo}`,
        });
      }

      return tx.receiving.update({
        where: { id },
        data: { status: 'RECEIVED', receivedBy: userId, receivedAt: new Date() },
        include: { items: true },
      });
    });

    await this.notificationsService.notifyRole(
      AppRole.WAREHOUSE_MANAGER,
      'RECEIVING_COMPLETED',
      'Receiving completed',
      `Receiving ${result.receivingNo} has been posted to inventory.`,
      { entityType: 'receiving', entityId: result.id, referenceNo: result.receivingNo },
    );

    return result;
  }

  async cancel(id: string) {
    const receiving = await this.prisma.receiving.findUnique({ where: { id } });
    if (!receiving) throw new NotFoundException('Receiving not found');
    if (receiving.status === 'RECEIVED') {
      throw new BadRequestException('Cannot cancel a receiving that has already posted to inventory');
    }
    return this.prisma.receiving.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
