import type { Prisma, ReferenceType, TransactionType } from '@prisma/client';

export interface ReservationAdjustment {
  itemId: string;
  warehouseId: string;
  locationId: string;
  /** Signed change to reserved_quantity. Positive reserves stock, negative releases it. */
  reservedDelta: Prisma.Decimal | number;
}

export interface MovementInput {
  transactionType: TransactionType;
  itemId: string;
  warehouseId: string;
  locationId: string;
  /**
   * Signed change to on-hand quantity: positive for inbound movements
   * (RECEIVE, TRANSFER_IN, RETURN, ADJUSTMENT_IN), negative for outbound
   * (ISSUE, TRANSFER_OUT, ADJUSTMENT_OUT). The stored ledger quantity is
   * always the unsigned magnitude; direction is carried by transactionType.
   */
  quantityDelta: Prisma.Decimal | number;
  /** Reservation released/consumed by this same movement, if any (e.g. issuance posting). */
  reservedDelta?: Prisma.Decimal | number;
  unitCost: Prisma.Decimal | number;
  referenceType: ReferenceType;
  referenceId: string;
  batchNo?: string | null;
  serialNo?: string | null;
  expiryDate?: Date | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  reversalOfId?: string | null;
  performedBy: string;
  approvedBy?: string | null;
  remarks?: string | null;
}
