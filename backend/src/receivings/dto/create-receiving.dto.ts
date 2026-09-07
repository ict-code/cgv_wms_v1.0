import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateReceivingItemDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  unitCost!: number;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateReceivingDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  purchaseReference?: string;

  @IsOptional()
  @IsString()
  deliveryReference?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateReceivingItemDto)
  @ArrayMinSize(1)
  items!: CreateReceivingItemDto[];
}
