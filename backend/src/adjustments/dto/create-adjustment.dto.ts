import { Type } from 'class-transformer';
import { ArrayMinSize, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export enum AdjustmentDirectionDto {
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
}

export enum AdjustmentReasonDto {
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  FOUND = 'FOUND',
  COUNTING_DISCREPANCY = 'COUNTING_DISCREPANCY',
  DATA_CORRECTION = 'DATA_CORRECTION',
  EXPIRED = 'EXPIRED',
  OTHER = 'OTHER',
}

export class CreateAdjustmentItemDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  locationId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsEnum(AdjustmentDirectionDto)
  adjustmentType!: AdjustmentDirectionDto;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;
}

export class CreateAdjustmentDto {
  @IsUUID()
  warehouseId!: string;

  @IsEnum(AdjustmentReasonDto)
  reason!: AdjustmentReasonDto;

  @IsOptional()
  @IsString()
  remarks?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateAdjustmentItemDto)
  @ArrayMinSize(1)
  items!: CreateAdjustmentItemDto[];
}
