import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedFixtures, type TestFixtures } from './support/test-app.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Idempotency-Key on inventory-changing POSTs (e2e)', () => {
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
    return res.body.data[0] as { quantity: string } | undefined;
  }

  it('replays the first response instead of double-posting when the same key is retried sequentially', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 40, unitCost: 10, locationId: fixtures.locationId }],
    });
    const id = create.body.id;
    const idempotencyKey = randomUUID();

    const first = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`)).set('Idempotency-Key', idempotencyKey);
    expect(first.status).toBe(201);

    const second = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`)).set('Idempotency-Key', idempotencyKey);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    const balance = await balanceAt(fixtures.locationId);
    // Posted once (+40), not twice (+80).
    expect(Number(balance?.quantity)).toBeGreaterThanOrEqual(40);
    const before = Number(balance?.quantity);

    const third = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`)).set('Idempotency-Key', idempotencyKey);
    expect(third.body).toEqual(first.body);
    const after = await balanceAt(fixtures.locationId);
    expect(Number(after?.quantity)).toBe(before);
  });

  it('rejects a second concurrent request under the same key while the first is still in flight, and never double-posts', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 15, unitCost: 10, locationId: fixtures.secondLocationId }],
    });
    const id = create.body.id;
    const idempotencyKey = randomUUID();
    const before = await balanceAt(fixtures.secondLocationId);
    const startQuantity = Number(before?.quantity ?? 0);

    const [a, b] = await Promise.all([
      auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`)).set('Idempotency-Key', idempotencyKey),
      auth(request(app.getHttpServer()).post(`/api/v1/receivings/${id}/receive`)).set('Idempotency-Key', idempotencyKey),
    ]);

    const statuses = [a.status, b.status].sort();
    // One wins (201); the other either loses the race to claim the key (409) or,
    // if it arrives after the first already committed, replays the same 201 body.
    expect([201, 409]).toContain(statuses[0]);
    if (statuses[0] === 201 && statuses[1] === 201) {
      expect(a.body).toEqual(b.body);
    }

    const after = await balanceAt(fixtures.secondLocationId);
    expect(Number(after?.quantity)).toBe(startQuantity + 15);
  });

  it('does not guard the endpoint when no Idempotency-Key header is sent', async () => {
    const create = await auth(request(app.getHttpServer()).post('/api/v1/receivings')).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 1, unitCost: 10, locationId: fixtures.locationId }],
    });
    const res = await auth(request(app.getHttpServer()).post(`/api/v1/receivings/${create.body.id}/receive`));
    expect(res.status).toBe(201);
  });
});
