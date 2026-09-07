import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppRole } from '../common/constants/roles.constant.js';
import type { NotificationsQueryDto } from './dto/notifications-query.dto.js';

export interface NotificationEntity {
  entityType?: string;
  entityId?: string;
  referenceNo?: string;
}

/**
 * Notification creation is intentionally called *after* the caller's inventory
 * transaction has already committed, never inside it — a notification failure
 * must never roll back or block an inventory-changing operation. Every method
 * here swallows its own errors (logged, not thrown) for the same reason.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUser(userId: string, type: NotificationType, title: string, message: string, entity?: NotificationEntity): Promise<void> {
    try {
      await this.prisma.notification.create({ data: { userId, type, title, message, ...entity } });
    } catch (error) {
      this.logger.warn(`Failed to create notification for user ${userId}: ${String(error)}`);
    }
  }

  async notifyRole(role: AppRole, type: NotificationType, title: string, message: string, entity?: NotificationEntity): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({ where: { role: { name: role }, status: 'ACTIVE' }, select: { id: true } });
      if (users.length === 0) return;
      await this.prisma.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type, title, message, ...entity })),
      });
    } catch (error) {
      this.logger.warn(`Failed to create role notification for ${role}: ${String(error)}`);
    }
  }

  /** Skips creating a duplicate low-stock/out-of-stock alert if an unread one for the same item already exists. */
  async notifyRoleDeduped(role: AppRole, type: NotificationType, title: string, message: string, entity: Required<NotificationEntity>): Promise<void> {
    try {
      const existing = await this.prisma.notification.findFirst({
        where: { type, entityType: entity.entityType, entityId: entity.entityId, readAt: null },
      });
      if (existing) return;
      await this.notifyRole(role, type, title, message, entity);
    } catch (error) {
      this.logger.warn(`Failed to create deduped role notification for ${role}: ${String(error)}`);
    }
  }

  async findForUser(userId: string, query: NotificationsQueryDto) {
    const where = { userId, ...(query.unreadOnly && { readAt: null }) };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize, unreadCount };
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  /**
   * Checks the item's total available quantity across the warehouse against
   * its reorder level and raises a deduped LOW_STOCK/OUT_OF_STOCK alert if
   * breached. Called after an outbound movement (issue/transfer-out/adjust-out)
   * commits — never inside the transaction itself.
   */
  async checkLowStock(itemId: string, warehouseId: string): Promise<void> {
    try {
      const [item, balances] = await Promise.all([
        this.prisma.item.findUnique({ where: { id: itemId } }),
        this.prisma.inventoryBalance.aggregate({ where: { itemId, warehouseId }, _sum: { availableQuantity: true } }),
      ]);
      if (!item || item.reorderLevel.lte(0)) return;

      const available = balances._sum.availableQuantity ?? new Prisma.Decimal(0);
      if (available.gt(item.reorderLevel)) return;

      const outOfStock = available.lte(0);
      await this.notifyRoleDeduped(
        AppRole.INVENTORY_CONTROLLER,
        outOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        outOfStock ? 'Out of stock' : 'Low stock alert',
        outOfStock
          ? `${item.name} (${item.itemCode}) is out of stock.`
          : `${item.name} (${item.itemCode}) is at or below its reorder level (${item.reorderLevel.toString()}).`,
        { entityType: 'item', entityId: item.id, referenceNo: item.itemCode },
      );
    } catch (error) {
      this.logger.warn(`Failed to check low stock for item ${itemId}: ${String(error)}`);
    }
  }

  /**
   * No scheduler is wired into this deployment (no BullMQ/cron), so this is
   * exposed as a POST endpoint an operator (or an external cron hitting the
   * API) triggers periodically, rather than firing automatically. Best-effort
   * for the same reason `reports.service.ts#expiring()` is: inventory_balances
   * isn't batch-tracked, so this looks at the most recent RECEIVE per
   * item+warehouse rather than an exact remaining-quantity-per-batch figure.
   */
  async checkExpiringItems(days = 30): Promise<{ notified: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const expiring = await this.prisma.inventoryTransaction.findMany({
      where: { transactionType: 'RECEIVE', expiryDate: { not: null, lte: cutoff, gte: new Date() } },
      include: { item: true, warehouse: true },
      orderBy: { expiryDate: 'asc' },
    });

    let notified = 0;
    for (const tx of expiring) {
      const expiryLabel = tx.expiryDate?.toISOString().slice(0, 10);
      await this.notifyRoleDeduped(
        AppRole.WAREHOUSE_MANAGER,
        'EXPIRING_SOON',
        'Item nearing expiry',
        `${tx.item.name} at ${tx.warehouse.name} expires ${expiryLabel}.`,
        { entityType: 'item', entityId: tx.itemId, referenceNo: tx.item.itemCode },
      );
      notified++;
    }
    return { notified };
  }
}
