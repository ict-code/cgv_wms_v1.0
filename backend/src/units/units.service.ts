import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateUnitDto } from './dto/create-unit.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.unit.findMany({ skip: pagination.skip, take: pagination.pageSize, orderBy: { name: 'asc' } }),
      this.prisma.unit.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  create(dto: CreateUnitDto) {
    return saveOrConflict(() => this.prisma.unit.create({ data: dto }));
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.unit.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.unit.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
    return toCsv(
      ['code', 'name', 'abbreviation', 'conversionFactor', 'status'],
      rows.map((r) => [r.code, r.name, r.abbreviation, r.conversionFactor.toString(), r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
    return toXlsx(
      'Units',
      ['Code', 'Name', 'Abbreviation', 'Conversion Factor', 'Status'],
      rows.map((r) => [r.code, r.name, r.abbreviation, r.conversionFactor.toString(), r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('code');
    const nameIdx = col('name');
    const abbrIdx = col('abbreviation');
    const factorIdx = col('conversionFactor');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1 || abbrIdx === -1) {
      throw new BadRequestException('CSV must include "code", "name", and "abbreviation" columns');
    }

    const errors: string[] = [];
    const seen = new Set<string>();
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const abbreviation = r[abbrIdx]?.trim() ?? '';
      const factorRaw = factorIdx >= 0 ? r[factorIdx]?.trim() : '';
      const conversionFactor = factorRaw ? Number(factorRaw) : 1;
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      if (!abbreviation) errors.push(`Row ${rowNum}: abbreviation is required`);
      if (factorRaw && Number.isNaN(conversionFactor)) errors.push(`Row ${rowNum}: conversionFactor must be a number`);
      if (code) {
        if (seen.has(code)) errors.push(`Row ${rowNum}: duplicate code "${code}" in file`);
        seen.add(code);
      }
      return { code, name, abbreviation, conversionFactor, status };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.unit.findUnique({ where: { code: rec.code } });
        if (existing) {
          await tx.unit.update({
            where: { id: existing.id },
            data: { name: rec.name, abbreviation: rec.abbreviation, conversionFactor: rec.conversionFactor, status: rec.status },
          });
          updated++;
        } else {
          await tx.unit.create({
            data: { code: rec.code, name: rec.name, abbreviation: rec.abbreviation, conversionFactor: rec.conversionFactor, status: rec.status },
          });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
