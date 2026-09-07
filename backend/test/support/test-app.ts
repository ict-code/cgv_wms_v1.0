import './test-db.js';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface TestFixtures {
  warehouseId: string;
  locationId: string;
  secondLocationId: string;
  categoryId: string;
  unitId: string;
  itemId: string;
  departmentId: string;
  supplierId: string;
  employeeId: string;
  adminToken: string;
  requesterToken: string;
  adminUserId: string;
}

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}

async function login(app: INestApplication, username: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username, password: 'Password123!' });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

/** Creates an isolated set of master-data fixtures (unique codes per call) so parallel test suites never collide. */
export async function seedFixtures(app: INestApplication, prisma: PrismaService): Promise<TestFixtures> {
  const suffix = randomUUID().slice(0, 8);

  const adminRole = await prisma.role.upsert({
    where: { name: 'Administrator' },
    update: {},
    create: { name: 'Administrator', description: 'Full system access' },
  });
  const requesterRole = await prisma.role.upsert({
    where: { name: 'Requester' },
    update: {},
    create: { name: 'Requester', description: 'Search inventory and create stock requests' },
  });

  const department = await prisma.department.create({
    data: { code: `DEPT-${suffix}`, name: `Test Department ${suffix}` },
  });

  const passwordHash = await bcrypt.hash('Password123!', 4);
  const adminUser = await prisma.user.create({
    data: {
      username: `admin-${suffix}`,
      passwordHash,
      fullname: 'Test Admin',
      email: `admin-${suffix}@test.invalid`,
      roleId: adminRole.id,
      departmentId: department.id,
    },
  });
  await prisma.user.create({
    data: {
      username: `requester-${suffix}`,
      passwordHash,
      fullname: 'Test Requester',
      email: `requester-${suffix}@test.invalid`,
      roleId: requesterRole.id,
      departmentId: department.id,
    },
  });

  const warehouse = await prisma.warehouse.create({ data: { code: `WH-${suffix}`, name: `Test Warehouse ${suffix}` } });
  const location = await prisma.location.create({
    data: { warehouseId: warehouse.id, code: `LOC-${suffix}`, name: `Test Location ${suffix}`, locationType: 'RACK' },
  });
  const secondLocation = await prisma.location.create({
    data: { warehouseId: warehouse.id, code: `LOC2-${suffix}`, name: `Test Location 2 ${suffix}`, locationType: 'RACK' },
  });
  const category = await prisma.category.create({ data: { code: `CAT-${suffix}`, name: `Test Category ${suffix}` } });
  const unit = await prisma.unit.create({ data: { code: `UNIT-${suffix}`, name: `Test Unit ${suffix}`, abbreviation: 'pc' } });
  const item = await prisma.item.create({
    data: {
      itemCode: `ITEM-${suffix}`,
      name: `Test Item ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      standardCost: 10,
    },
  });
  const supplier = await prisma.supplier.create({ data: { code: `SUP-${suffix}`, name: `Test Supplier ${suffix}` } });
  const employee = await prisma.employee.create({
    data: { fullname: `Test Employee ${suffix}`, departmentId: department.id },
  });

  const [adminToken, requesterToken] = await Promise.all([login(app, `admin-${suffix}`), login(app, `requester-${suffix}`)]);

  return {
    warehouseId: warehouse.id,
    locationId: location.id,
    secondLocationId: secondLocation.id,
    categoryId: category.id,
    unitId: unit.id,
    itemId: item.id,
    departmentId: department.id,
    supplierId: supplier.id,
    employeeId: employee.id,
    adminUserId: adminUser.id,
    adminToken,
    requesterToken,
  };
}
