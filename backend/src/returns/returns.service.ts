import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';
import type { ReturnsQueryDto } from './dto/returns-query.dto.js';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(query: ReturnsQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { department: true, warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.return.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: { department: true, warehouse: true, originalIssuance: true, items: { include: { item: true, location: true } } },
    });
    if (!ret) throw new NotFoundException('Return not found');
    return ret;
  }

  async create(dto: CreateReturnDto) {
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.items.map((i) => i.itemId) } } });
    for (const line of dto.items) {
      if (!items.find((i) => i.id === line.itemId)) throw new BadRequestException(`Item ${line.itemId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const [{ no: returnNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('RET', 'seq_return_no') as no
      `;
      return tx.return.create({
        data: {
          returnNo,
          originalIssuanceId: dto.originalIssuanceId,
          departmentId: dto.departmentId,
          warehouseId: dto.warehouseId,
          reason: dto.reason,
          status: 'DRAFT',
          items: {
            create: dto.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              locationId: line.locationId,
              batchNo: line.batchNo,
              serialNo: line.serialNo,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async receive(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({ where: { id }, include: { items: true } });
      if (!ret) throw new NotFoundException('Return not found');
      if (ret.status !== 'DRAFT') {
        throw new BadRequestException(`Cannot post a return in status ${ret.status}`);
      }

      for (const line of ret.items) {
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });

        await this.inventoryService.postMovement(tx, {
          transactionType: 'RETURN',
          itemId: line.itemId,
          warehouseId: ret.warehouseId,
          locationId: line.locationId,
          quantityDelta: Number(line.quantity),
          unitCost: item.standardCost,
          referenceType: 'RETURN',
          referenceId: ret.id,
          batchNo: line.batchNo,
          serialNo: line.serialNo,
          performedBy: userId,
          remarks: `Return ${ret.returnNo}`,
        });
      }

      return tx.return.update({
        where: { id },
        data: { status: 'RECEIVED', receivedBy: userId },
        include: { items: true },
      });
    });
  }

  async cancel(id: string) {
    const ret = await this.prisma.return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.status === 'RECEIVED') {
      throw new BadRequestException('Cannot cancel a return that has already posted to inventory');
    }
    return this.prisma.return.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
