import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StorageItemsService } from './storage-items.service.js';
import { CreateStorageItemDto } from './dto/create-storage-item.dto.js';
import { UpdateStorageItemDto } from './dto/update-storage-item.dto.js';
import { StorageItemsQueryDto } from './dto/storage-items-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { RequireModule } from '../common/decorators/require-module.decorator.js';

const CAN_LOG = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];
const CAN_RELEASE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER];

@ApiBearerAuth()
@ApiTags('storage-items')
@RequireModule('storage-items')
@Controller('storage-items')
export class StorageItemsController {
  constructor(private readonly service: StorageItemsService) {}

  @Get()
  findAll(@Query() query: StorageItemsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...CAN_LOG)
  @Post()
  create(@Body() dto: CreateStorageItemDto) {
    return this.service.create(dto);
  }

  @Roles(...CAN_LOG)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStorageItemDto) {
    return this.service.update(id, dto);
  }

  @Roles(...CAN_RELEASE)
  @Post(':id/retrieve')
  retrieve(@Param('id') id: string) {
    return this.service.retrieve(id);
  }

  @Roles(...CAN_RELEASE)
  @Post(':id/dispose')
  dispose(@Param('id') id: string) {
    return this.service.dispose(id);
  }

  @Roles(AppRole.ADMINISTRATOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
