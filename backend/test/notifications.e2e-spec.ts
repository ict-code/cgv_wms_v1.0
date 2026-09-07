import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedFixtures, type TestFixtures } from './support/test-app.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Notifications (e2e)', () => {
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

  function auth(token: string, req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  it('notifies the requester when their issuance is approved, and it shows up in their inbox as unread', async () => {
    // Stock the item first so approval (which reserves) can succeed.
    const receive = await auth(
      fixtures.adminToken,
      request(app.getHttpServer()).post('/api/v1/receivings'),
    ).send({
      supplierId: fixtures.supplierId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantity: 10, unitCost: 10, locationId: fixtures.locationId }],
    });
    await auth(fixtures.adminToken, request(app.getHttpServer()).post(`/api/v1/receivings/${receive.body.id}/receive`));

    // Requester creates the issuance (so requestedBy = the requester, not the admin).
    const create = await auth(fixtures.requesterToken, request(app.getHttpServer()).post('/api/v1/issuances')).send({
      requestingDepartmentId: fixtures.departmentId,
      employeeId: fixtures.employeeId,
      warehouseId: fixtures.warehouseId,
      items: [{ itemId: fixtures.itemId, quantityRequested: 2, locationId: fixtures.locationId }],
    });
    expect(create.status).toBe(201);

    const before = await auth(fixtures.requesterToken, request(app.getHttpServer()).get('/api/v1/notifications'));
    const unreadBefore = before.body.unreadCount;

    const approve = await auth(fixtures.adminToken, request(app.getHttpServer()).post(`/api/v1/issuances/${create.body.id}/approve`));
    expect(approve.status).toBe(201);

    const after = await auth(fixtures.requesterToken, request(app.getHttpServer()).get('/api/v1/notifications'));
    expect(after.body.unreadCount).toBe(unreadBefore + 1);
    const notification = after.body.data.find((n: { type: string }) => n.type === 'ISSUANCE_APPROVED');
    expect(notification).toBeTruthy();
    expect(notification.readAt).toBeNull();

    const markRead = await auth(fixtures.requesterToken, request(app.getHttpServer()).post(`/api/v1/notifications/${notification.id}/read`));
    expect(markRead.status).toBe(201);

    const afterRead = await auth(fixtures.requesterToken, request(app.getHttpServer()).get('/api/v1/notifications'));
    expect(afterRead.body.unreadCount).toBe(unreadBefore);
  });

  it('does not leak another user\'s notifications', async () => {
    const adminNotifications = await auth(fixtures.adminToken, request(app.getHttpServer()).get('/api/v1/notifications'));
    const requesterIds = new Set(
      (await auth(fixtures.requesterToken, request(app.getHttpServer()).get('/api/v1/notifications'))).body.data.map((n: { id: string }) => n.id),
    );
    for (const n of adminNotifications.body.data as { id: string }[]) {
      expect(requesterIds.has(n.id)).toBe(false);
    }
  });
});
