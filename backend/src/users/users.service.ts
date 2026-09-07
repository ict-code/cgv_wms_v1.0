import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { deleteOrConflict, saveOrConflict } from '../common/utils/prisma-errors.util.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const SAFE_SELECT = {
  id: true,
  username: true,
  fullname: true,
  email: true,
  roleId: true,
  departmentId: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: true,
  department: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { username: 'asc' },
        select: SAFE_SELECT,
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return saveOrConflict(() =>
      this.prisma.user.create({
        data: {
          username: dto.username,
          passwordHash,
          fullname: dto.fullname,
          email: dto.email,
          roleId: dto.roleId,
          departmentId: dto.departmentId,
        },
        select: SAFE_SELECT,
      }),
    );
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return saveOrConflict(() => this.prisma.user.update({ where: { id }, data: dto, select: SAFE_SELECT }));
  }

  async remove(id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.findOne(id);
    await deleteOrConflict(() => this.prisma.user.delete({ where: { id } }));
  }
}
