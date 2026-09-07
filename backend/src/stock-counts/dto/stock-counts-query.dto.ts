import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export class StockCountsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'CANCELLED'])
  status?: string;
}
