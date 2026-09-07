import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ItemsService } from './items.service.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { ItemsQueryDto } from './dto/items-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';

@ApiBearerAuth()
@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

  @Get()
  findAll(@Query() query: ItemsQueryDto) {
    return this.service.findAll(query);
  }

  @Get('export.xlsx')
  async exportXlsx(@Res() res: Response) {
    const buffer = await this.service.exportXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="items.xlsx"');
    res.send(buffer);
  }

  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string) {
    return this.service.findByBarcode(barcode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(AppRole.ADMINISTRATOR, AppRole.INVENTORY_CONTROLLER)
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.service.create(dto);
  }

  @Roles(AppRole.ADMINISTRATOR, AppRole.INVENTORY_CONTROLLER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.service.update(id, dto);
  }

  @Roles(AppRole.ADMINISTRATOR, AppRole.INVENTORY_CONTROLLER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
