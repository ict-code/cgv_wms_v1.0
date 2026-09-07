import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  fullname!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
