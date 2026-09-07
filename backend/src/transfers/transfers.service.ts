import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import type { TransfersQueryDto } from './dto/transfers-query.dto.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: TransfersQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { warehouse: true, fromLocation: true, toLocation: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        warehouse: true,
        fromLocation: true,
        toLocation: true,
        items: { include: { item: true } },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async create(dto: CreateTransferDto, userId: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('Source and destination locations must differ');
    }
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.items.map((i) => i.itemId) } } });
    for (const line of dto.items) {
      if (!items.find((i) => i.id === line.itemId)) throw new BadRequestException(`Item ${line.itemId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const [{ no: transferNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('TRF', 'seq_transfer_no') as no
      `;
      return tx.transfer.create({
        data: {
          transferNo,
          warehouseId: dto.warehouseId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          requestedBy: userId,
          remarks: dto.remarks,
          status: 'PENDING_APPROVAL',
          items: {
            create: dto.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              batchNo: line.batchNo,
              serialNo: line.serialNo,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async approve(id: string, userId: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Cannot approve a transfer in status ${transfer.status}`);
    }
    return this.prisma.transfer.update({ where: { id }, data: { status: 'APPROVED', approvedBy: userId } });
  }

  async execute(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id }, include: { items: true } });
      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status !== 'APPROVED') {
        throw new BadRequestException(`Cannot execute a transfer in status ${transfer.status}`);
      }

      for (const line of transfer.items) {
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });

        await this.inventoryService.postMovement(tx, {
          transactionType: 'TRANSFER_OUT',
          itemId: line.itemId,
          warehouseId: transfer.warehouseId,
          locationId: transfer.fromLocationId,
          quantityDelta: -Number(line.quantity),
          unitCost: item.standardCost,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          batchNo: line.batchNo,
          serialNo: line.serialNo,
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId,
          performedBy: userId,
          approvedBy: transfer.approvedBy,
          remarks: `Transfer ${transfer.transferNo}`,
        });

        await this.inventoryService.postMovement(tx, {
          transactionType: 'TRANSFER_IN',
          itemId: line.itemId,
          warehouseId: transfer.warehouseId,
          locationId: transfer.toLocationId,
          quantityDelta: Number(line.quantity),
          unitCost: item.standardCost,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          batchNo: line.batchNo,
          serialNo: line.serialNo,
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId,
          performedBy: userId,
          approvedBy: transfer.approvedBy,
          remarks: `Transfer ${transfer.transferNo}`,
        });
      }

      return tx.transfer.update({
        where: { id },
        data: { status: 'COMPLETED', executedBy: userId },
        include: { items: true },
      });
    });

    await this.notificationsService.notifyUser(
      result.requestedBy,
      'TRANSFER_COMPLETED',
      'Transfer completed',
      `Transfer ${result.transferNo} has been completed.`,
      { entityType: 'transfer', entityId: result.id, referenceNo: result.transferNo },
    );
    for (const line of result.items) {
      await this.notificationsService.checkLowStock(line.itemId, result.warehouseId);
    }

    return result;
  }

  async cancel(id: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a transfer in status ${transfer.status}`);
    }
    return this.prisma.transfer.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
