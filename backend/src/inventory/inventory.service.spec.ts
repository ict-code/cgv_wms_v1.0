import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service.js';
import { InsufficientInventoryException } from './exceptions/insufficient-inventory.exception.js';
import type { AuditService } from '../audit/audit.service.js';

interface MockBalance {
  id: string;
  quantity: number;
  reservedQuantity: number;
}

function setup(initial: { quantity: number; reservedQuantity: number }) {
  const auditService = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const service = new InventoryService(auditService);
  let balance: MockBalance = { id: 'balance-1', quantity: initial.quantity, reservedQuantity: initial.reservedQuantity };

  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn((strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('generate_doc_no')) return Promise.resolve([{ no: 'TXN-TEST-000001' }]);
      return Promise.resolve([
        { id: balance.id, quantity: new Prisma.Decimal(balance.quantity), reservedQuantity: new Prisma.Decimal(balance.reservedQuantity) },
      ]);
    }),
    inventoryBalance: {
      update: vi.fn(({ data }: { data: { quantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal } }) => {
        balance = { id: balance.id, quantity: Number(data.quantity), reservedQuantity: Number(data.reservedQuantity) };
        return Promise.resolve({ id: balance.id, ...data });
      }),
    },
    inventoryTransaction: {
      create: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve({ id: 'txn-1', ...args.data })),
    },
  } as unknown as Prisma.TransactionClient;

  return { service, tx, getBalance: () => balance };
}

describe('InventoryService.postMovement', () => {
  it('increases quantity on an inbound movement and writes an immutable transaction record with the unsigned magnitude', async () => {
    const { service, tx, getBalance } = setup({ quantity: 0, reservedQuantity: 0 });

    const result = await service.postMovement(tx, {
      transactionType: 'RECEIVE',
      itemId: 'item-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      quantityDelta: 100,
      unitCost: 5,
      referenceType: 'RECEIVING',
      referenceId: 'recv-1',
      performedBy: 'user-1',
    });

    expect(getBalance().quantity).toBe(100);
    expect(result.quantity.toString()).toBe('100');
    expect(result.totalCost.toString()).toBe('500');
  });

  it('decreases quantity on an outbound movement', async () => {
    const { service, tx, getBalance } = setup({ quantity: 50, reservedQuantity: 0 });

    await service.postMovement(tx, {
      transactionType: 'ISSUE',
      itemId: 'item-1',
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      quantityDelta: -20,
      unitCost: 5,
      referenceType: 'ISSUANCE',
      referenceId: 'iss-1',
      performedBy: 'user-1',
    });

    expect(getBalance().quantity).toBe(30);
  });

  it('rejects a movement that would drive on-hand quantity negative', async () => {
    const { service, tx } = setup({ quantity: 10, reservedQuantity: 0 });

    await expect(
      service.postMovement(tx, {
        transactionType: 'ISSUE',
        itemId: 'item-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        quantityDelta: -20,
        unitCost: 5,
        referenceType: 'ISSUANCE',
        referenceId: 'iss-1',
        performedBy: 'user-1',
      }),
    ).rejects.toBeInstanceOf(InsufficientInventoryException);
  });

  it('rejects a movement that would drive available quantity negative even though on-hand quantity stays non-negative', async () => {
    // quantity 10, reserved 8 -> available 2. Issuing 5 leaves quantity 5 (non-negative) but available -3.
    const { service, tx } = setup({ quantity: 10, reservedQuantity: 8 });

    await expect(
      service.postMovement(tx, {
        transactionType: 'ISSUE',
        itemId: 'item-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        quantityDelta: -5,
        unitCost: 5,
        referenceType: 'ISSUANCE',
        referenceId: 'iss-1',
        performedBy: 'user-1',
      }),
    ).rejects.toBeInstanceOf(InsufficientInventoryException);
  });
});

describe('InventoryService.adjustReservation', () => {
  it('reserves stock without touching on-hand quantity', async () => {
    const { service, tx, getBalance } = setup({ quantity: 10, reservedQuantity: 0 });

    await service.adjustReservation(tx, { itemId: 'item-1', warehouseId: 'wh-1', locationId: 'loc-1', reservedDelta: 7 });

    expect(getBalance().reservedQuantity).toBe(7);
    expect(getBalance().quantity).toBe(10);
  });

  it('rejects a reservation that would exceed on-hand quantity (negative available)', async () => {
    const { service, tx } = setup({ quantity: 10, reservedQuantity: 0 });

    await expect(
      service.adjustReservation(tx, { itemId: 'item-1', warehouseId: 'wh-1', locationId: 'loc-1', reservedDelta: 11 }),
    ).rejects.toBeInstanceOf(InsufficientInventoryException);
  });

  it('rejects releasing more reservation than currently held (negative reservedQuantity)', async () => {
    const { service, tx } = setup({ quantity: 10, reservedQuantity: 3 });

    await expect(
      service.adjustReservation(tx, { itemId: 'item-1', warehouseId: 'wh-1', locationId: 'loc-1', reservedDelta: -5 }),
    ).rejects.toBeInstanceOf(InsufficientInventoryException);
  });
});
