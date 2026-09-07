import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type InventoryTransaction } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { InsufficientInventoryException } from './exceptions/insufficient-inventory.exception.js';
import type { MovementInput, ReservationAdjustment } from './inventory.types.js';

interface LockedBalance {
  id: string;
  quantity: Prisma.Decimal;
  reservedQuantity: Prisma.Decimal;
}

@Injectable()
export class InventoryService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Ensures a balance row exists for (item, warehouse, location) and locks it
   * with SELECT ... FOR UPDATE for the duration of the caller's transaction,
   * so concurrent movements against the same balance serialize instead of
   * racing on a read-modify-write.
   */
  private async lockBalance(
    tx: Prisma.TransactionClient,
    itemId: string,
    warehouseId: string,
    locationId: string,
  ): Promise<LockedBalance> {
    await tx.$executeRaw`
      INSERT INTO inventory_balances (id, item_id, warehouse_id, location_id, quantity, reserved_quantity, available_quantity, updated_at)
      VALUES (${randomUUID()}::uuid, ${itemId}::uuid, ${warehouseId}::uuid, ${locationId}::uuid, 0, 0, 0, now())
      ON CONFLICT (item_id, warehouse_id, location_id) DO NOTHING
    `;

    const rows = await tx.$queryRaw<LockedBalance[]>`
      SELECT id, quantity, reserved_quantity as "reservedQuantity"
      FROM inventory_balances
      WHERE item_id = ${itemId}::uuid AND warehouse_id = ${warehouseId}::uuid AND location_id = ${locationId}::uuid
      FOR UPDATE
    `;
    return rows[0]!;
  }

  private async writeBalance(
    tx: Prisma.TransactionClient,
    id: string,
    quantity: Prisma.Decimal,
    reservedQuantity: Prisma.Decimal,
    itemId: string,
    locationId: string,
  ): Promise<void> {
    const available = quantity.minus(reservedQuantity);
    if (available.isNegative()) {
      throw new InsufficientInventoryException(itemId, locationId);
    }
    await tx.inventoryBalance.update({
      where: { id },
      data: { quantity, reservedQuantity, availableQuantity: available, updatedAt: new Date() },
    });
  }

  /**
   * Reserves or releases stock without moving it (used by the issuance
   * approve/cancel lifecycle). Never touches quantity or the transaction
   * ledger — reservation is not a stock movement.
   */
  async adjustReservation(tx: Prisma.TransactionClient, input: ReservationAdjustment): Promise<void> {
    const balance = await this.lockBalance(tx, input.itemId, input.warehouseId, input.locationId);
    const delta = new Prisma.Decimal(input.reservedDelta);
    const newReserved = balance.reservedQuantity.plus(delta);
    if (newReserved.isNegative()) {
      throw new InsufficientInventoryException(input.itemId, input.locationId);
    }
    await this.writeBalance(tx, balance.id, balance.quantity, newReserved, input.itemId, input.locationId);
  }

  /**
   * Posts an actual stock movement: locks the balance, applies the signed
   * quantity delta (and optional reservation release), rejects the result if
   * it would leave quantity or available_quantity negative, then writes the
   * immutable inventory_transactions row with a concurrency-safe doc number.
   * Must be called inside the caller's Prisma interactive transaction so the
   * balance update, ledger entry, and parent document status change commit
   * or roll back together.
   */
  async postMovement(tx: Prisma.TransactionClient, input: MovementInput): Promise<InventoryTransaction> {
    const balance = await this.lockBalance(tx, input.itemId, input.warehouseId, input.locationId);

    const quantityDelta = new Prisma.Decimal(input.quantityDelta);
    const reservedDelta = new Prisma.Decimal(input.reservedDelta ?? 0);
    const newQuantity = balance.quantity.plus(quantityDelta);
    const newReserved = balance.reservedQuantity.plus(reservedDelta);

    if (newQuantity.isNegative()) {
      throw new InsufficientInventoryException(input.itemId, input.locationId);
    }
    await this.writeBalance(tx, balance.id, newQuantity, newReserved, input.itemId, input.locationId);

    const [{ no: transactionNo }] = await tx.$queryRaw<{ no: string }[]>`
      SELECT generate_doc_no('TXN', 'seq_transaction_no') as no
    `;

    const unitCost = new Prisma.Decimal(input.unitCost);
    const magnitude = quantityDelta.abs();
    const transaction = await tx.inventoryTransaction.create({
      data: {
        transactionNo,
        transactionType: input.transactionType,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        quantity: magnitude,
        unitCost,
        totalCost: magnitude.times(unitCost),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        batchNo: input.batchNo ?? null,
        serialNo: input.serialNo ?? null,
        expiryDate: input.expiryDate ?? null,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        reversalOfId: input.reversalOfId ?? null,
        performedBy: input.performedBy,
        approvedBy: input.approvedBy ?? null,
        remarks: input.remarks ?? null,
      },
    });

    await this.auditService.record(tx, {
      userId: input.performedBy,
      action: `INVENTORY_${input.transactionType}`,
      entityType: 'inventory_transactions',
      entityId: transaction.id,
      referenceNo: transactionNo,
      newValues: {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        quantity: magnitude.toString(),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });

    return transaction;
  }
}
