import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageItemsService, STORAGE_ITEM_UPLOADS_DIR } from './storage-items.service.js';
import { CreateStorageItemDto } from './dto/create-storage-item.dto.js';
import { UpdateStorageItemDto } from './dto/update-storage-item.dto.js';
import { StorageItemsQueryDto } from './dto/storage-items-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { RequireModule } from '../common/decorators/require-module.decorator.js';

const CAN_LOG = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER, AppRole.WAREHOUSE_STAFF];
const CAN_RELEASE = [AppRole.ADMINISTRATOR, AppRole.WAREHOUSE_MANAGER];

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

if (!existsSync(STORAGE_ITEM_UPLOADS_DIR)) {
  mkdirSync(STORAGE_ITEM_UPLOADS_DIR, { recursive: true });
}

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

  @Get('barcode/:code')
  findByCode(@Param('code') code: string) {
    return this.service.findByCode(code);
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

  @Roles(...CAN_LOG)
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: STORAGE_ITEM_UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.setPhoto(id, file.filename);
  }

  @Get(':id/photo')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const path = await this.service.getPhotoPath(id);
    res.sendFile(path);
  }

  @Roles(...CAN_LOG)
  @Delete(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(@Param('id') id: string) {
    return this.service.removePhoto(id);
  }

  @Roles(AppRole.ADMINISTRATOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
