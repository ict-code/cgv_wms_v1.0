import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedFixtures, type TestFixtures } from './support/test-app.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Spec's own concurrency example: available = 10, User A issues 7, User B issues 5,
 * concurrently, against the same balance. Exactly one must succeed, the other must
 * fail, and the final balance must never go negative or become corrupted.
 */
describe('Concurrent inventory operations (e2e)', () => {
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

  it('lets exactly one of two simultaneous issuance approvals succeed against a balance of 10 when they request 7 and 5', async () => {
    const receive = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 10, unitCost: 10, locationId: fixtures.locationId }],
    });
    await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${receive.body.id}/receive`));

    const [issuanceA, issuanceB] = await Promise.all([
      auth(request(app.getHttpServer()).post('/api/v1/issuances')).send({
        requestingDepartmentId: fixtures.departmentId,
        employeeId: fixtures.employeeId,
        warehouseId: fixtures.warehouseId,
        items: [{ itemId: fixtures.itemId, quantityRequested: 7, locationId: fixtures.locationId }],
      }),
      auth(request(app.getHttpServer()).post('/api/v1/issuances')).send({
        requestingDepartmentId: fixtures.departmentId,
        employeeId: fixtures.employeeId,
        warehouseId: fixtures.warehouseId,
        items: [{ itemId: fixtures.itemId, quantityRequested: 5, locationId: fixtures.locationId }],
      }),
    ]);
    expect(issuanceA.status).toBe(201);
    expect(issuanceB.status).toBe(201);

    const [approveA, approveB] = await Promise.all([
      auth(request(app.getHttpServer()).post(`/api/v1/issuances/${issuanceA.body.id}/approve`)),
      auth(request(app.getHttpServer()).post(`/api/v1/issuances/${issuanceB.body.id}/approve`)),
    ]);

    const outcomes = [approveA.status, approveB.status].sort();
    // One request must succeed (201) and the other must be rejected as insufficient inventory (400) —
    // never both succeeding (which would corrupt the balance) and never both failing.
    expect(outcomes).toEqual([201, 400]);

    const balanceRes = await auth(request(app.getHttpServer()).get('/api/v1/inventory')).query({
      itemId: fixtures.itemId,
      warehouseId: fixtures.warehouseId,
      locationId: fixtures.locationId,
      pageSize: 10,
    });
    const balance = balanceRes.body.data[0] as { quantity: string; reservedQuantity: string; availableQuantity: string };

    expect(Number(balance.quantity)).toBe(10);
    expect(Number(balance.reservedQuantity)).toBeGreaterThanOrEqual(0);
    expect(Number(balance.availableQuantity)).toBeGreaterThanOrEqual(0);
    // The winning reservation is either 7 or 5, never both stacked (12) and never neither (0).
    expect([5, 7]).toContain(Number(balance.reservedQuantity));
  });

  it('never lets on-hand quantity go negative under concurrent adjustment posts against a small balance', async () => {
    const receive = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 5, unitCost: 10, locationId: fixtures.secondLocationId }],
    });
    await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${receive.body.id}/receive`));

    async function createAndApprove(quantity: number) {
      const create = await auth(request(app.getHttpServer()).post('/api/v1/adjustments')).send({
        warehouseId: fixtures.warehouseId,
        reason: 'DAMAGED',
        items: [{ itemId: fixtures.itemId, locationId: fixtures.secondLocationId, quantity, adjustmentType: 'ADJUSTMENT_OUT' }],
      });
      await auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${create.body.id}/approve`));
      return create.body.id as string;
    }

    const [adjustmentA, adjustmentB] = await Promise.all([createAndApprove(4), createAndApprove(4)]);

    const [postA, postB] = await Promise.all([
      auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${adjustmentA}/post`)),
      auth(request(app.getHttpServer()).post(`/api/v1/adjustments/${adjustmentB}/post`)),
    ]);

    const outcomes = [postA.status, postB.status].sort();
    expect(outcomes).toEqual([201, 400]);

    const balanceRes = await auth(request(app.getHttpServer()).get('/api/v1/inventory')).query({
      itemId: fixtures.itemId,
      warehouseId: fixtures.warehouseId,
      locationId: fixtures.secondLocationId,
      pageSize: 10,
    });
    const balance = balanceRes.body.data[0] as { quantity: string };
    expect(Number(balance.quantity)).toBe(1);
    expect(Number(balance.quantity)).toBeGreaterThanOrEqual(0);
  });
});
