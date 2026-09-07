import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentHeadId?: string;
}
