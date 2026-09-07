import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({ skip: pagination.skip, take: pagination.pageSize, orderBy: { name: 'asc' } }),
      this.prisma.supplier.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  create(dto: CreateSupplierDto) {
    return saveOrConflict(() => this.prisma.supplier.create({ data: dto }));
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.supplier.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.supplier.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    return toCsv(
      ['code', 'name', 'contactPerson', 'phone', 'email', 'address', 'taxIdentifier', 'status'],
      rows.map((r) => [r.code, r.name, r.contactPerson, r.phone, r.email, r.address, r.taxIdentifier, r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    return toXlsx(
      'Suppliers',
      ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Tax Identifier', 'Status'],
      rows.map((r) => [r.code, r.name, r.contactPerson, r.phone, r.email, r.address, r.taxIdentifier, r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('code');
    const nameIdx = col('name');
    const contactIdx = col('contactPerson');
    const phoneIdx = col('phone');
    const emailIdx = col('email');
    const addressIdx = col('address');
    const taxIdx = col('taxIdentifier');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1) throw new BadRequestException('CSV must include "code" and "name" columns');

    const errors: string[] = [];
    const seen = new Set<string>();
    const get = (r: string[], idx: number) => (idx >= 0 ? r[idx]?.trim() || null : null);
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      if (code) {
        if (seen.has(code)) errors.push(`Row ${rowNum}: duplicate code "${code}" in file`);
        seen.add(code);
      }
      return {
        code,
        name,
        contactPerson: get(r, contactIdx),
        phone: get(r, phoneIdx),
        email: get(r, emailIdx),
        address: get(r, addressIdx),
        taxIdentifier: get(r, taxIdx),
        status,
      };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.supplier.findUnique({ where: { code: rec.code } });
        if (existing) {
          await tx.supplier.update({ where: { id: existing.id }, data: rec });
          updated++;
        } else {
          await tx.supplier.create({ data: rec });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
