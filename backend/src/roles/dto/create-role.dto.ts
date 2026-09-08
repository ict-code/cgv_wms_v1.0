import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { MODULE_KEYS, type ModuleKey } from '../../common/constants/modules.constant.js';

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(MODULE_KEYS, { each: true })
  modules!: ModuleKey[];
}
