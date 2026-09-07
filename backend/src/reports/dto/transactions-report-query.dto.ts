import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

const TRANSACTION_TYPES = [
  'RECEIVE',
  'ISSUE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'RETURN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'STOCK_COUNT',
  'REVERSAL',
] as const;

export class TransactionsReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
