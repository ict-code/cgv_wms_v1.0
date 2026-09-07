import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({ skip: pagination.skip, take: pagination.pageSize, orderBy: { name: 'asc' } }),
      this.prisma.category.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  create(dto: CreateCategoryDto) {
    return saveOrConflict(() => this.prisma.category.create({ data: dto }));
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.category.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.category.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return toCsv(
      ['code', 'name', 'description', 'status'],
      rows.map((r) => [r.code, r.name, r.description, r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return toXlsx(
      'Categories',
      ['Code', 'Name', 'Description', 'Status'],
      rows.map((r) => [r.code, r.name, r.description, r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('code');
    const nameIdx = col('name');
    const descIdx = col('description');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1) throw new BadRequestException('CSV must include "code" and "name" columns');

    const errors: string[] = [];
    const seen = new Set<string>();
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const description = descIdx >= 0 ? r[descIdx]?.trim() || null : null;
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      if (code) {
        if (seen.has(code)) errors.push(`Row ${rowNum}: duplicate code "${code}" in file`);
        seen.add(code);
      }
      return { code, name, description, status };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.category.findUnique({ where: { code: rec.code } });
        if (existing) {
          await tx.category.update({ where: { id: existing.id }, data: { name: rec.name, description: rec.description, status: rec.status } });
          updated++;
        } else {
          await tx.category.create({ data: { code: rec.code, name: rec.name, description: rec.description, status: rec.status } });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
