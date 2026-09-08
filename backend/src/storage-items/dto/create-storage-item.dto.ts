import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const STORAGE_ITEM_TYPES = ['DOCUMENT_BOX', 'FURNITURE', 'EQUIPMENT', 'OTHER'] as const;

export class CreateStorageItemDto {
  @IsString()
  description!: string;

  @IsIn(STORAGE_ITEM_TYPES)
  itemType!: (typeof STORAGE_ITEM_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  ownerDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  custodianId?: string;

  @IsOptional()
  @IsDateString()
  dateStored?: string;

  @IsOptional()
  @IsDateString()
  disposalDueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
