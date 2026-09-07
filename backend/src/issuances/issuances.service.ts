import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateIssuanceDto } from './dto/create-issuance.dto.js';
import type { IssueIssuanceDto } from './dto/issue-issuance.dto.js';
import type { IssuancesQueryDto } from './dto/issuances-query.dto.js';

@Injectable()
export class IssuancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: IssuancesQueryDto) {
    const where = {
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
      ...(query.departmentId && { requestingDepartmentId: query.departmentId }),
      ...(query.status && { status: query.status as never }),
    };
    const [data, total] = await Promise.all([
      this.prisma.issuance.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { requestingDepartment: true, employee: true, warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.issuance.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const issuance = await this.prisma.issuance.findUnique({
      where: { id },
      include: { requestingDepartment: true, employee: true, warehouse: true, items: { include: { item: true, location: true } } },
    });
    if (!issuance) throw new NotFoundException('Issuance not found');
    return issuance;
  }

  async create(dto: CreateIssuanceDto, userId: string) {
    const items = await this.prisma.item.findMany({ where: { id: { in: dto.items.map((i) => i.itemId) } } });
    for (const line of dto.items) {
      if (!items.find((i) => i.id === line.itemId)) throw new BadRequestException(`Item ${line.itemId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const [{ no: issuanceNo }] = await tx.$queryRaw<{ no: string }[]>`
        SELECT generate_doc_no('ISS', 'seq_issuance_no') as no
      `;
      return tx.issuance.create({
        data: {
          issuanceNo,
          requestingDepartmentId: dto.requestingDepartmentId,
          employeeId: dto.employeeId,
          warehouseId: dto.warehouseId,
          requestedBy: userId,
          purpose: dto.purpose,
          remarks: dto.remarks,
          status: 'PENDING_APPROVAL',
          items: {
            create: dto.items.map((line) => ({
              itemId: line.itemId,
              quantityRequested: line.quantityRequested,
              locationId: line.locationId,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async approve(id: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const issuance = await tx.issuance.findUnique({ where: { id }, include: { items: true } });
      if (!issuance) throw new NotFoundException('Issuance not found');
      if (issuance.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(`Cannot approve an issuance in status ${issuance.status}`);
      }

      for (const line of issuance.items) {
        await this.inventoryService.adjustReservation(tx, {
          itemId: line.itemId,
          warehouseId: issuance.warehouseId,
          locationId: line.locationId,
          reservedDelta: line.quantityRequested,
        });
      }

      return tx.issuance.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: userId },
        include: { items: true },
      });
    });

    await this.notificationsService.notifyUser(
      result.requestedBy,
      'ISSUANCE_APPROVED',
      'Issuance approved',
      `Your issuance request ${result.issuanceNo} has been approved.`,
      { entityType: 'issuance', entityId: result.id, referenceNo: result.issuanceNo },
    );

    return result;
  }

  async issue(id: string, userId: string, dto: IssueIssuanceDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const issuance = await tx.issuance.findUnique({ where: { id }, include: { items: true } });
      if (!issuance) throw new NotFoundException('Issuance not found');
      if (issuance.status !== 'APPROVED') {
        throw new BadRequestException(`Cannot post an issuance in status ${issuance.status}`);
      }

      for (const line of issuance.items) {
        const override = dto.overrides?.find((o) => o.issuanceItemId === line.id);
        const quantityIssued = override?.quantityIssued ?? Number(line.quantityRequested);
        if (quantityIssued > Number(line.quantityRequested)) {
          throw new BadRequestException('Quantity issued cannot exceed quantity requested');
        }

        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });

        await this.inventoryService.postMovement(tx, {
          transactionType: 'ISSUE',
          itemId: line.itemId,
          warehouseId: issuance.warehouseId,
          locationId: line.locationId,
          quantityDelta: -quantityIssued,
          reservedDelta: -Number(line.quantityRequested),
          unitCost: item.standardCost,
          referenceType: 'ISSUANCE',
          referenceId: issuance.id,
          performedBy: userId,
          approvedBy: issuance.approvedBy,
          remarks: `Issuance ${issuance.issuanceNo}`,
        });

        await tx.issuanceItem.update({ where: { id: line.id }, data: { quantityIssued, unitCost: item.standardCost } });
      }

      return tx.issuance.update({
        where: { id },
        data: { status: 'ISSUED', issuedBy: userId },
        include: { items: true },
      });
    });

    await this.notificationsService.notifyUser(
      result.requestedBy,
      'ISSUANCE_ISSUED',
      'Issuance posted',
      `Issuance ${result.issuanceNo} has been posted and goods released.`,
      { entityType: 'issuance', entityId: result.id, referenceNo: result.issuanceNo },
    );
    for (const line of result.items) {
      await this.notificationsService.checkLowStock(line.itemId, result.warehouseId);
    }

    return result;
  }

  async cancel(id: string) {
    let wasPendingApproval = false;

    const result = await this.prisma.$transaction(async (tx) => {
      const issuance = await tx.issuance.findUnique({ where: { id }, include: { items: true } });
      if (!issuance) throw new NotFoundException('Issuance not found');
      if (issuance.status === 'ISSUED' || issuance.status === 'CANCELLED' || issuance.status === 'REJECTED') {
        throw new BadRequestException(`Cannot cancel an issuance in status ${issuance.status}`);
      }

      if (issuance.status === 'APPROVED') {
        for (const line of issuance.items) {
          await this.inventoryService.adjustReservation(tx, {
            itemId: line.itemId,
            warehouseId: issuance.warehouseId,
            locationId: line.locationId,
            reservedDelta: -Number(line.quantityRequested),
          });
        }
      }
      wasPendingApproval = issuance.status === 'PENDING_APPROVAL';

      return tx.issuance.update({ where: { id }, data: { status: 'CANCELLED' }, include: { items: true } });
    });

    await this.notificationsService.notifyUser(
      result.requestedBy,
      'ISSUANCE_REJECTED',
      wasPendingApproval ? 'Issuance rejected' : 'Issuance cancelled',
      wasPendingApproval
        ? `Your issuance request ${result.issuanceNo} was rejected.`
        : `Issuance ${result.issuanceNo} was cancelled after approval and its reservation released.`,
      { entityType: 'issuance', entityId: result.id, referenceNo: result.issuanceNo },
    );

    return result;
  }
}
