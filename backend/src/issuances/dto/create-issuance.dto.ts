import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreateIssuanceItemDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityRequested!: number;

  @IsUUID()
  locationId!: string;
}

export class CreateIssuanceDto {
  @IsUUID()
  requestingDepartmentId!: string;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateIssuanceItemDto)
  @ArrayMinSize(1)
  items!: CreateIssuanceItemDto[];
}
