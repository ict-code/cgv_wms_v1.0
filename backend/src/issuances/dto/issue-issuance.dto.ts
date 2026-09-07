import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class IssueLineOverrideDto {
  @IsUUID()
  issuanceItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityIssued!: number;
}

export class IssueIssuanceDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => IssueLineOverrideDto)
  overrides?: IssueLineOverrideDto[];
}
