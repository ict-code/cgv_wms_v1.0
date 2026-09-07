import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'Administrator', description: 'Full system access' },
  { name: 'Warehouse Manager', description: 'Manages operational warehouse activities and approvals' },
  { name: 'Warehouse Staff', description: 'Performs authorized receiving, issuance, transfers, stock counts' },
  { name: 'Inventory Controller', description: 'Reviews variances, prepares adjustments, generates reports' },
  { name: 'Requester', description: 'Searches inventory and creates stock requests' },
  { name: 'Auditor', description: 'Read-only access to inventory, transactions, and audit logs' },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }

  const department = await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: { code: 'ADMIN', name: 'Administration' },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Administrator' } });

  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const generatedPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullname: 'System Administrator',
        email: 'admin@vigan.gov.ph.invalid',
        roleId: adminRole.id,
        departmentId: department.id,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`\nSeeded admin user — username: admin, password: ${generatedPassword}\nChange this password after first login; it is not stored anywhere else.\n`);
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { code: 'MAIN', name: 'Main Warehouse', description: 'Placeholder — replace with the client\'s actual warehouse name/code' },
  });

  await prisma.location.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'RECV' } },
    update: {},
    create: { warehouseId: warehouse.id, code: 'RECV', name: 'Receiving Dock', locationType: 'RECEIVING' },
  });

  await prisma.category.upsert({
    where: { code: 'GEN' },
    update: {},
    create: { code: 'GEN', name: 'General', description: 'Placeholder default category' },
  });

  await prisma.unit.upsert({
    where: { code: 'PC' },
    update: {},
    create: { code: 'PC', name: 'Piece', abbreviation: 'pc' },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
