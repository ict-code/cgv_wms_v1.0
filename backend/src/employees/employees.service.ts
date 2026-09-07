import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { toCsv } from '../common/utils/csv.util.js';
import { toXlsx } from '../common/utils/xlsx.util.js';
import { parseImportCsv, parseStatus } from '../common/utils/csv-import.util.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { EmployeesQueryDto } from './dto/employees-query.dto.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EmployeesQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.departmentId && { departmentId: query.departmentId }),
      ...(query.search && {
        OR: [
          { fullname: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        include: { department: true },
        orderBy: { fullname: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: { department: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  create(dto: CreateEmployeeDto) {
    return saveOrConflict(() => this.prisma.employee.create({ data: dto, include: { department: true } }));
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.employee.update({ where: { id }, data: dto, include: { department: true } }));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.employee.delete({ where: { id } }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.employee.findMany({ include: { department: true }, orderBy: { fullname: 'asc' } });
    return toCsv(
      ['employeeCode', 'fullname', 'departmentCode', 'position', 'email', 'phone', 'status'],
      rows.map((r) => [r.employeeCode, r.fullname, r.department?.code ?? '', r.position, r.email, r.phone, r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.employee.findMany({ include: { department: true }, orderBy: { fullname: 'asc' } });
    return toXlsx(
      'Employees',
      ['Employee Code', 'Full Name', 'Department Code', 'Position', 'Email', 'Phone', 'Status'],
      rows.map((r) => [r.employeeCode, r.fullname, r.department?.code ?? '', r.position, r.email, r.phone, r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const codeIdx = col('employeeCode');
    const nameIdx = col('fullname');
    const deptIdx = col('departmentCode');
    const positionIdx = col('position');
    const emailIdx = col('email');
    const phoneIdx = col('phone');
    const statusIdx = col('status');
    if (codeIdx === -1 || nameIdx === -1) throw new BadRequestException('CSV must include "employeeCode" and "fullname" columns');

    const departments = await this.prisma.department.findMany();
    const departmentByCode = new Map(departments.map((d) => [d.code, d]));

    const errors: string[] = [];
    const seen = new Set<string>();
    const get = (r: string[], idx: number) => (idx >= 0 ? r[idx]?.trim() || null : null);
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const employeeCode = r[codeIdx]?.trim() ?? '';
      const fullname = r[nameIdx]?.trim() ?? '';
      const deptCode = deptIdx >= 0 ? r[deptIdx]?.trim() : '';
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!employeeCode) errors.push(`Row ${rowNum}: employeeCode is required`);
      if (!fullname) errors.push(`Row ${rowNum}: fullname is required`);
      let departmentId: string | null = null;
      if (deptCode) {
        const department = departmentByCode.get(deptCode);
        if (!department) errors.push(`Row ${rowNum}: department "${deptCode}" not found`);
        else departmentId = department.id;
      }
      if (employeeCode) {
        if (seen.has(employeeCode)) errors.push(`Row ${rowNum}: duplicate employeeCode "${employeeCode}" in file`);
        seen.add(employeeCode);
      }
      return {
        employeeCode,
        fullname,
        departmentId,
        position: get(r, positionIdx),
        email: get(r, emailIdx),
        phone: get(r, phoneIdx),
        status,
      };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.employee.findUnique({ where: { employeeCode: rec.employeeCode } });
        if (existing) {
          await tx.employee.update({ where: { id: existing.id }, data: rec });
          updated++;
        } else {
          await tx.employee.create({ data: rec });
          created++;
        }
      }
      return { created, updated };
    });
  }
}
