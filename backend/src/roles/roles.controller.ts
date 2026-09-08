import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { RequireModule } from '../common/decorators/require-module.decorator.js';

@ApiBearerAuth()
@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(AppRole.ADMINISTRATOR)
  @RequireModule('roles')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(AppRole.ADMINISTRATOR)
  @RequireModule('roles')
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Roles(AppRole.ADMINISTRATOR)
  @RequireModule('roles')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.update(id, dto);
  }

  @Roles(AppRole.ADMINISTRATOR)
  @RequireModule('roles')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
