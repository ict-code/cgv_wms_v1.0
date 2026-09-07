import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class StockCountLineDto {
  @IsUUID()
  stockCountItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  physicalQuantity!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SubmitStockCountDto {
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  @ArrayMinSize(1)
  items!: StockCountLineDto[];
}
