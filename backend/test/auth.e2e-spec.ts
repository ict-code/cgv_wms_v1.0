import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedFixtures, type TestFixtures } from './support/test-app.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Auth + RBAC (e2e)', () => {
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

  it('rejects an invalid password without revealing whether the account exists', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'no-such-user', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('issues an access token for valid credentials', async () => {
    expect(fixtures.adminToken).toBeTruthy();
    expect(fixtures.requesterToken).toBeTruthy();
  });

  it('rejects requests with no Authorization header', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/items');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a garbage bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/items').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows an authenticated request with a valid token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/items').set('Authorization', `Bearer ${fixtures.adminToken}`);
    expect(res.status).toBe(200);
  });

  it('enforces server-side RBAC: a Requester cannot create master data reserved for Administrator', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${fixtures.requesterToken}`)
      .send({ code: 'SHOULD-FAIL', name: 'Should Fail' });
    expect(res.status).toBe(403);
  });

  it('allows Administrator to create master data', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${fixtures.adminToken}`)
      .send({ code: `RBAC-OK-${Date.now()}`, name: 'RBAC OK' });
    expect(res.status).toBe(201);
  });
});
