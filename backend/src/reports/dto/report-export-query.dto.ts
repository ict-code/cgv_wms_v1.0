import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';

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

/** Union of every filter any report in the catalog accepts; each report reads only the ones relevant to it. */
export class ReportExportQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @IsOptional()
  @IsUUID()
  stockCountId?: string;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  days?: number;
}
