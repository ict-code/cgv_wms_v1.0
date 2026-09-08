import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
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

export const STORAGE_ITEM_UPLOADS_DIR = process.env.STORAGE_UPLOADS_DIR ?? join(process.cwd(), 'uploads', 'storage-items');

async function deleteFileIfExists(filename: string | null): Promise<void> {
  if (!filename) return;
  try {
    await fs.unlink(join(STORAGE_ITEM_UPLOADS_DIR, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// The frontend sends plain "YYYY-MM-DD" date-only strings, but Prisma's client
// requires a full ISO-8601 datetime for a `DateTime` column (only `@db.Date`
// columns tolerate a date-only string) — convert here rather than relaxing
// the DTO's @IsDateString validation, which correctly accepts both shapes.
function normalizeDates<T extends { dateStored?: string; disposalDueDate?: string }>(
  dto: T,
): Omit<T, 'dateStored' | 'disposalDueDate'> & { dateStored?: Date; disposalDueDate?: Date } {
  const { dateStored, disposalDueDate, ...rest } = dto;
  return {
    ...rest,
    ...(dateStored !== undefined ? { dateStored: new Date(dateStored) } : {}),
    ...(disposalDueDate !== undefined ? { disposalDueDate: new Date(disposalDueDate) } : {}),
  };
}

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

  async findByCode(code: string) {
    const storageItem = await this.prisma.storageItem.findUnique({ where: { code }, include: INCLUDE });
    if (!storageItem) throw new NotFoundException('No storage item matches this code');
    return storageItem;
  }

  create(dto: CreateStorageItemDto) {
    return saveOrConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const [{ no: code }] = await tx.$queryRaw<{ no: string }[]>`SELECT generate_doc_no('STG', 'seq_storage_no') as no`;
        return tx.storageItem.create({ data: { ...normalizeDates(dto), code }, include: INCLUDE });
      }),
    );
  }

  async update(id: string, dto: UpdateStorageItemDto) {
    const storageItem = await this.findOne(id);
    if (storageItem.status === 'DISPOSED') {
      throw new BadRequestException('Cannot edit a storage item that has already been disposed');
    }
    return saveOrConflict(() => this.prisma.storageItem.update({ where: { id }, data: normalizeDates(dto), include: INCLUDE }));
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

  async setPhoto(id: string, filename: string) {
    const storageItem = await this.findOne(id);
    await deleteFileIfExists(storageItem.photoFilename);
    return this.prisma.storageItem.update({ where: { id }, data: { photoFilename: filename }, include: INCLUDE });
  }

  async removePhoto(id: string): Promise<void> {
    const storageItem = await this.findOne(id);
    await deleteFileIfExists(storageItem.photoFilename);
    await this.prisma.storageItem.update({ where: { id }, data: { photoFilename: null } });
  }

  async getPhotoPath(id: string): Promise<string> {
    const storageItem = await this.findOne(id);
    if (!storageItem.photoFilename) throw new NotFoundException('This storage item has no photo');
    return join(STORAGE_ITEM_UPLOADS_DIR, storageItem.photoFilename);
  }

  async remove(id: string): Promise<void> {
    const storageItem = await this.findOne(id);
    await deleteOrConflict(() => this.prisma.storageItem.delete({ where: { id } }));
    await deleteFileIfExists(storageItem.photoFilename);
  }
}
