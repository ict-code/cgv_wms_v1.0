import { BadRequestException } from '@nestjs/common';

export class InsufficientInventoryException extends BadRequestException {
  constructor(itemId: string, locationId: string) {
    super(`Insufficient available inventory for item ${itemId} at location ${locationId}`);
  }
}
