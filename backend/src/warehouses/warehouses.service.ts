import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({ skip: pagination.skip, take: pagination.pageSize, orderBy: { name: 'asc' } }),
      this.prisma.warehouse.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  create(dto: CreateWarehouseDto) {
    return saveOrConflict(() => this.prisma.warehouse.create({ data: dto }));
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.warehouse.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.warehouse.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
    return toCsv(
      ['code', 'name', 'description', 'address', 'status'],
      rows.map((r) => [r.code, r.name, r.description, r.address, r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
    return toXlsx(
      'Warehouses',
      ['Code', 'Name', 'Description', 'Address', 'Status'],
      rows.map((r) => [r.code, r.name, r.description, r.address, r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('code');
    const nameIdx = col('name');
    const descIdx = col('description');
    const addressIdx = col('address');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1) throw new BadRequestException('CSV must include "code" and "name" columns');

    const errors: string[] = [];
    const seen = new Set<string>();
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const description = descIdx >= 0 ? r[descIdx]?.trim() || null : null;
      const address = addressIdx >= 0 ? r[addressIdx]?.trim() || null : null;
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      if (code) {
        if (seen.has(code)) errors.push(`Row ${rowNum}: duplicate code "${code}" in file`);
        seen.add(code);
      }
      return { code, name, description, address, status };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.warehouse.findUnique({ where: { code: rec.code } });
        if (existing) {
          await tx.warehouse.update({ where: { id: existing.id }, data: rec });
          updated++;
        } else {
          await tx.warehouse.create({ data: rec });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
