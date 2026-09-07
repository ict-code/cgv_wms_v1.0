import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import type { LocationsQueryDto } from './dto/locations-query.dto.js';

const LOCATION_TYPES = ['ZONE', 'RACK', 'SHELF', 'BIN', 'FLOOR', 'STAGING', 'RECEIVING', 'DISPATCH', 'QUARANTINE'] as const;

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LocationsQueryDto) {
    const where = query.warehouseId ? { warehouseId: query.warehouseId } : {};
    const [data, total] = await Promise.all([
      this.prisma.location.findMany({ where, skip: query.skip, take: query.pageSize, orderBy: { code: 'asc' } }),
      this.prisma.location.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id }, include: { childLocations: true } });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  create(dto: CreateLocationDto) {
    return saveOrConflict(() => this.prisma.location.create({ data: dto }));
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.location.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.location.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.location.findMany({ include: { warehouse: true }, orderBy: { code: 'asc' } });
    return toCsv(
      ['warehouseCode', 'code', 'name', 'locationType', 'status'],
      rows.map((r) => [r.warehouse.code, r.code, r.name, r.locationType, r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.location.findMany({ include: { warehouse: true }, orderBy: { code: 'asc' } });
    return toXlsx(
      'Locations',
      ['Warehouse Code', 'Code', 'Name', 'Location Type', 'Status'],
      rows.map((r) => [r.warehouse.code, r.code, r.name, r.locationType, r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const warehouseIdx = col('warehouseCode');
    const codeIdx = col('code');
    const nameIdx = col('name');
    const typeIdx = col('locationType');
    const statusIdx = col('status');
    if (warehouseIdx === -1 || codeIdx === -1 || nameIdx === -1 || typeIdx === -1) {
      throw new BadRequestException('CSV must include "warehouseCode", "code", "name", and "locationType" columns');
    }

    const warehouses = await this.prisma.warehouse.findMany();
    const warehouseByCode = new Map(warehouses.map((w) => [w.code, w]));

    const errors: string[] = [];
    const seen = new Set<string>();
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const warehouseCode = r[warehouseIdx]?.trim() ?? '';
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const locationType = r[typeIdx]?.trim().toUpperCase() ?? '';
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      const warehouse = warehouseByCode.get(warehouseCode);
      if (!warehouseCode) errors.push(`Row ${rowNum}: warehouseCode is required`);
      else if (!warehouse) errors.push(`Row ${rowNum}: warehouse "${warehouseCode}" not found`);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      if (!LOCATION_TYPES.includes(locationType as (typeof LOCATION_TYPES)[number])) {
        errors.push(`Row ${rowNum}: locationType must be one of ${LOCATION_TYPES.join(', ')}`);
      }
      const dedupeKey = `${warehouseCode}|${code}`;
      if (warehouseCode && code) {
        if (seen.has(dedupeKey)) errors.push(`Row ${rowNum}: duplicate code "${code}" for warehouse "${warehouseCode}" in file`);
        seen.add(dedupeKey);
      }
      return { warehouseId: warehouse?.id ?? '', code, name, locationType, status };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.location.findUnique({ where: { warehouseId_code: { warehouseId: rec.warehouseId, code: rec.code } } });
        if (existing) {
          await tx.location.update({
            where: { id: existing.id },
            data: { name: rec.name, locationType: rec.locationType as (typeof LOCATION_TYPES)[number], status: rec.status },
          });
          updated++;
        } else {
          await tx.location.create({
            data: {
              warehouseId: rec.warehouseId,
              code: rec.code,
              name: rec.name,
              locationType: rec.locationType as (typeof LOCATION_TYPES)[number],
              status: rec.status,
            },
          });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
