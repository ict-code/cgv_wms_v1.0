import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { name: 'asc' },
        include: { departmentHead: true },
      }),
      this.prisma.department.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id }, include: { departmentHead: true } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  create(dto: CreateDepartmentDto) {
    return saveOrConflict(() => this.prisma.department.create({ data: dto, include: { departmentHead: true } }));
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.department.update({ where: { id }, data: dto, include: { departmentHead: true } }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.department.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.department.findMany({ include: { departmentHead: true }, orderBy: { name: 'asc' } });
    return toCsv(
      ['ofc_code', 'ofc_desc', 'ofc_depthead', 'status'],
      rows.map((r) => [r.code, r.name, r.departmentHead?.employeeCode ?? '', r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.department.findMany({ include: { departmentHead: true }, orderBy: { name: 'asc' } });
    return toXlsx(
      'Departments',
      ['ofc_code', 'ofc_desc', 'ofc_depthead', 'status'],
      rows.map((r) => [r.code, r.name, r.departmentHead?.employeeCode ?? '', r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('ofc_code');
    const nameIdx = col('ofc_desc');
    const headIdx = col('ofc_depthead');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1) throw new BadRequestException('CSV must include "ofc_code" and "ofc_desc" columns');

    const employees = await this.prisma.employee.findMany();
    const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

    const errors: string[] = [];
    const seen = new Set<string>();
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const code = r[codeIdx]?.trim() ?? '';
      const name = r[nameIdx]?.trim() ?? '';
      const headCode = headIdx >= 0 ? r[headIdx]?.trim() : '';
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!code) errors.push(`Row ${rowNum}: code is required`);
      if (!name) errors.push(`Row ${rowNum}: name is required`);
      let departmentHeadId: string | null = null;
      if (headCode) {
        const employee = employeeByCode.get(headCode);
        if (!employee) errors.push(`Row ${rowNum}: employee "${headCode}" not found`);
        else departmentHeadId = employee.id;
      }
      if (code) {
        if (seen.has(code)) errors.push(`Row ${rowNum}: duplicate code "${code}" in file`);
        seen.add(code);
      }
      return { code, name, departmentHeadId, status };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.department.findUnique({ where: { code: rec.code } });
        if (existing) {
          await tx.department.update({ where: { id: existing.id }, data: rec });
          updated++;
        } else {
          await tx.department.create({ data: rec });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
