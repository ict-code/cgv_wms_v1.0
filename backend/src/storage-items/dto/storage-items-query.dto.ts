import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

const STORAGE_ITEM_STATUSES = ['STORED', 'RETRIEVED', 'DISPOSED'] as const;

export class StorageItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  ownerDepartmentId?: string;

  @IsOptional()
  @IsIn(STORAGE_ITEM_STATUSES)
  status?: (typeof STORAGE_ITEM_STATUSES)[number];
}
