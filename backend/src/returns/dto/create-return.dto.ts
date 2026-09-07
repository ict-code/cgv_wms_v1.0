import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreateReturnItemDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;
}

export class CreateReturnDto {
  @IsOptional()
  @IsUUID()
  originalIssuanceId?: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  @ArrayMinSize(1)
  items!: CreateReturnItemDto[];
}
