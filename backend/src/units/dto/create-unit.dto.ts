import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  abbreviation!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  conversionFactor?: number;
}
