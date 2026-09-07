import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiBearerAuth()
@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':transactionId')
  async findOne(@Param('transactionId') transactionId: string) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({
      where: { id: transactionId },
      include: {
        item: true,
        warehouse: true,
        location: true,
        fromLocation: true,
        toLocation: true,
        performedByUser: { select: { id: true, fullname: true } },
        approvedByUser: { select: { id: true, fullname: true } },
      },
    });
    if (!transaction) throw new NotFoundException('Inventory transaction not found');
    return transaction;
  }
}
