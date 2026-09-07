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
        fullname: { contains: query.search, mode: 'insensitive' },
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
      ['full_name', 'employee_id_number', 'email', 'position', 'office_code', 'status'],
      rows.map((r) => [r.fullname, r.employeeIdNumber, r.email, r.position, r.department?.code ?? '', r.status]),
    );
  }

  async exportXlsx(): Promise<Buffer> {
    const rows = await this.prisma.employee.findMany({ include: { department: true }, orderBy: { fullname: 'asc' } });
    return toXlsx(
      'Employees',
      ['full_name', 'employee_id_number', 'email', 'position', 'office_code', 'status'],
      rows.map((r) => [r.fullname, r.employeeIdNumber, r.email, r.position, r.department?.code ?? '', r.status]),
    );
  }

  async importCsv(text: string): Promise<{ created: number; updated: number }> {
    const { rows, col } = parseImportCsv(text);
    const nameIdx = col('full_name');
    const idNumberIdx = col('employee_id_number');
    const deptIdx = col('office_code');
    const positionIdx = col('position');
    const emailIdx = col('email');
    const statusIdx = col('status');
    if (nameIdx === -1) throw new BadRequestException('CSV must include a "full_name" column');

    const departments = await this.prisma.department.findMany();
    const departmentByCode = new Map(departments.map((d) => [d.code, d]));

    const errors: string[] = [];
    const seen = new Set<string>();
    const seenIdNumbers = new Set<string>();
    const get = (r: string[], idx: number) => (idx >= 0 ? r[idx]?.trim() || null : null);
    const records = rows.map((r, i) => {
      const rowNum = i + 2;
      const fullname = r[nameIdx]?.trim() ?? '';
      const employeeIdNumber = get(r, idNumberIdx);
      const deptCode = deptIdx >= 0 ? r[deptIdx]?.trim() : '';
      const status = parseStatus(statusIdx >= 0 ? r[statusIdx] : undefined, rowNum, errors);
      if (!fullname) errors.push(`Row ${rowNum}: full_name is required`);
      let departmentId: string | null = null;
      if (deptCode) {
        const department = departmentByCode.get(deptCode);
        if (!department) errors.push(`Row ${rowNum}: office "${deptCode}" not found`);
        else departmentId = department.id;
      }
      if (fullname) {
        if (seen.has(fullname)) errors.push(`Row ${rowNum}: duplicate full_name "${fullname}" in file`);
        seen.add(fullname);
      }
      if (employeeIdNumber) {
        if (seenIdNumbers.has(employeeIdNumber)) errors.push(`Row ${rowNum}: duplicate employee_id_number "${employeeIdNumber}" in file`);
        seenIdNumbers.add(employeeIdNumber);
      }
      return {
        fullname,
        employeeIdNumber,
        departmentId,
        position: get(r, positionIdx),
        email: get(r, emailIdx),
        status,
      };
    });

    if (errors.length > 0) throw new BadRequestException({ message: 'Import failed', errors });

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const rec of records) {
        const existing = await tx.employee.findUnique({ where: { fullname: rec.fullname } });
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
