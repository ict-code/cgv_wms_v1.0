import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import type { ItemsQueryDto } from './dto/items-query.dto.js';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ItemsQueryDto) {
    const where: Prisma.ItemWhereInput = {
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { itemCode: { contains: query.search, mode: 'insensitive' } },
          { barcode: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
          { brand: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { category: true, unit: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.item.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id }, include: { category: true, unit: true } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async findByBarcode(barcode: string) {
    const item = await this.prisma.item.findUnique({ where: { barcode }, include: { category: true, unit: true } });
    if (!item) throw new NotFoundException('No item matches this barcode');
    return item;
  }

  create(dto: CreateItemDto) {
    return saveOrConflict(() => this.prisma.item.create({ data: dto }));
  }

  async update(id: string, dto: UpdateItemDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.item.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.item.delete({ where: { id } }));
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.item.findMany({ include: { category: true, unit: true }, orderBy: { name: 'asc' } });
    return toXlsx(
      'Items',
      ['Item Code', 'Barcode', 'Name', 'Category', 'Unit', 'Brand', 'Reorder Level', 'Standard Cost', 'Status'],
      rows.map((r) => [
        r.itemCode,
        r.barcode,
        r.name,
        r.category.name,
        r.unit.abbreviation,
        r.brand,
        r.reorderLevel.toString(),
        r.standardCost.toString(),
        r.status,
      ]),
    );
  }
}
