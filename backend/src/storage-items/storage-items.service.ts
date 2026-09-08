import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { CreateStorageItemDto } from './dto/create-storage-item.dto.js';
import { UpdateStorageItemDto } from './dto/update-storage-item.dto.js';
import type { StorageItemsQueryDto } from './dto/storage-items-query.dto.js';

const INCLUDE = {
  location: { include: { warehouse: true } },
  ownerDepartment: true,
  custodian: true,
} as const;

@Injectable()
export class StorageItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StorageItemsQueryDto) {
    const where = {
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.ownerDepartmentId ? { ownerDepartmentId: query.ownerDepartmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.storageItem.findMany({ where, include: INCLUDE, skip: query.skip, take: query.pageSize, orderBy: { dateStored: 'desc' } }),
      this.prisma.storageItem.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const storageItem = await this.prisma.storageItem.findUnique({ where: { id }, include: INCLUDE });
    if (!storageItem) throw new NotFoundException('Storage item not found');
    return storageItem;
  }

  create(dto: CreateStorageItemDto) {
    return saveOrConflict(() => this.prisma.storageItem.create({ data: dto, include: INCLUDE }));
  }

  async update(id: string, dto: UpdateStorageItemDto) {
    const storageItem = await this.findOne(id);
    if (storageItem.status === 'DISPOSED') {
      throw new BadRequestException('Cannot edit a storage item that has already been disposed');
    }
    return saveOrConflict(() => this.prisma.storageItem.update({ where: { id }, data: dto, include: INCLUDE }));
  }

  async retrieve(id: string) {
    const storageItem = await this.findOne(id);
    if (storageItem.status !== 'STORED') {
      throw new BadRequestException(`Cannot retrieve: this item is already ${storageItem.status.toLowerCase()}`);
    }
    return this.prisma.storageItem.update({
      where: { id },
      data: { status: 'RETRIEVED', retrievedAt: new Date() },
      include: INCLUDE,
    });
  }

  async dispose(id: string) {
    const storageItem = await this.findOne(id);
    if (storageItem.status === 'DISPOSED') {
      throw new BadRequestException('This item has already been disposed');
    }
    return this.prisma.storageItem.update({
      where: { id },
      data: { status: 'DISPOSED', disposedAt: new Date() },
      include: INCLUDE,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.storageItem.delete({ where: { id } }));
  }
}
