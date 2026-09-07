import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateItemDto {
  @IsString()
  itemCode!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  unitId!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reorderLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maximumStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  standardCost?: number;

  @IsOptional()
  @IsBoolean()
  trackSerial?: boolean;

  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;
}
