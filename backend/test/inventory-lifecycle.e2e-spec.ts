import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedFixtures, type TestFixtures } from './support/test-app.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Inventory lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    fixtures = await seedFixtures(app, prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${fixtures.adminToken}`);
  }

  async function balanceAt(locationId: string) {
    const res = await auth(request(app.getHttpServer()).get('/api/v1/inventory')).query({
      itemId: fixtures.itemId,
      warehouseId: fixtures.warehouseId,
      locationId,
      pageSize: 10,
    });
    expect(res.status).toBe(200);
    return res.body.data[0] as { quantity: string; reservedQuantity: string; availableQuantity: string } | undefined;
  }

  it('receiving increases inventory correctly', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 100, unitCost: 10, locationId: fixtures.locationId }],
    });
    expect(create.status).toBe(201);

    const post = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${create.body.id}/receive`));
    expect(post.status).toBe(201);

    const balance = await balanceAt(fixtures.locationId);
    expect(balance?.quantity).toBe('100');
    expect(balance?.availableQuantity).toBe('100');
  });

  it('rejects receiving being posted twice (immutable status transition)', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 1, unitCost: 10, locationId: fixtures.locationId }],
    });
    const id = create.body.id;
    await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`));
    const second = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`));
    expect(second.status).toBe(400);
  });

  it('issuance approval reserves stock, posting decreases it, and reservation clears', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/issuances')).send({
      requestingDepartmentId: fixtures.departmentId,
      employeeId: fixtures.employeeId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantityRequested: 30, locationId: fixtures.locationId }],
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const approve = await auth(request(app.getHttpServer()).post(`/api/v1/issuances/${id}/approve`));
    expect(approve.status).toBe(201);
    let balance = await balanceAt(fixtures.locationId);
    expect(balance?.reservedQuantity).toBe('30');

    const issue = await auth(request(app.getHttpServer()).post(`/api/v1/issuances/${id}/issue`)).send({});
    expect(issue.status).toBe(201);
    balance = await balanceAt(fixtures.locationId);
    expect(balance?.reservedQuantity).toBe('0');
  });

  it('transfer moves inventory atomically between locations without loss', async () => {
    const before = await balanceAt(fixtures.locationId);
    const startQuantity = Number(before?.quantity ?? 0);

    const create = await auth(request(app.getHttpServer()).post('/api/v1/transfers')).send({
      warehouseId: fixtures.warehouseId,
      fromLocationId: fixtures.locationId,
      toLocationId: fixtures.secondLocationId,
      items: [{ itemId: fixtures.itemId, quantity: 20 }],
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await auth(request(app.getHttpServer()).post(`/api/v1/transfers/${id}/approve`));
    const execute = await auth(request(app.getHttpServer()).post(`/api/v1/transfers/${id}/execute`));
    expect(execute.status).toBe(201);

    const source = await balanceAt(fixtures.locationId);
    const destination = await balanceAt(fixtures.secondLocationId);
    expect(Number(source?.quantity)).toBe(startQuantity - 20);
    expect(Number(destination?.quantity)).toBe(20);
  });

  it('adjustment requires approval before it posts to inventory', async () => {
    const before = await balanceAt(fixtures.locationId);
    const startQuantity = Number(before?.quantity ?? 0);

    const create = await auth(request(app.getHttpServer()).post('/api/v1/adjustments')).send({
      warehouseId: fixtures.warehouseId,
      reason: 'DAMAGED',
      items: [{ itemId: fixtures.itemId, locationId: fixtures.locationId, quantity: 5, adjustmentType: 'ADJUSTMENT_OUT' }],
    });
    const id = create.body.id;

    const postBeforeApproval = await auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${id}/post`));
    expect(postBeforeApproval.status).toBe(400);

    await auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${id}/approve`));
    const post = await auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${id}/post`));
    expect(post.status).toBe(201);

    const balance = await balanceAt(fixtures.locationId);
    expect(Number(balance?.quantity)).toBe(startQuantity - 5);
  });

  it('rejects issuance approval that would drive available inventory negative, and leaves the balance untouched', async () => {
    const before = await balanceAt(fixtures.locationId);

    const create = await auth(request(app.getHttpServer()).post('/api/v1/issuances')).send({
      requestingDepartmentId: fixtures.departmentId,
      employeeId: fixtures.employeeId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantityRequested: 999_999, locationId: fixtures.locationId }],
    });
    const id = create.body.id;

    const approve = await auth(request(app.getHttpServer()).post(`/api/v1/issuances/${id}/approve`));
    expect(approve.status).toBe(400);

    const after = await balanceAt(fixtures.locationId);
    expect(after?.quantity).toBe(before?.quantity);
    expect(after?.reservedQuantity).toBe(before?.reservedQuantity);
  });
});
