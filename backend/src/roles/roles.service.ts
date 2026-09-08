import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { AppRole } from '../common/constants/roles.constant.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

const BUILT_IN_ROLE_NAMES: string[] = Object.values(AppRole);

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  create(dto: CreateRoleDto) {
    return saveOrConflict(() => this.prisma.role.create({ data: dto }));
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (BUILT_IN_ROLE_NAMES.includes(role.name) && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename a built-in system role');
    }
    return saveOrConflict(() => this.prisma.role.update({ where: { id }, data: dto }));
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (BUILT_IN_ROLE_NAMES.includes(role.name)) {
      throw new BadRequestException('Cannot delete a built-in system role');
    }
    await deleteOrConflict(() => this.prisma.role.delete({ where: { id } }));
  }
}
