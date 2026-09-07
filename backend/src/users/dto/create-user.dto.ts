import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullname!: string;

  @IsEmail()
  email!: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
