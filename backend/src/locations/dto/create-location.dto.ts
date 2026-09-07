import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export enum LocationTypeDto {
  ZONE = 'ZONE',
  RACK = 'RACK',
  SHELF = 'SHELF',
  BIN = 'BIN',
  FLOOR = 'FLOOR',
  STAGING = 'STAGING',
  RECEIVING = 'RECEIVING',
  DISPATCH = 'DISPATCH',
  QUARANTINE = 'QUARANTINE',
}

export class CreateLocationDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(LocationTypeDto)
  locationType!: LocationTypeDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacity?: number;
}
