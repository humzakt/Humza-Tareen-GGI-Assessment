import request from 'supertest';

jest.mock('../../../src/lib/prisma/client', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    subscription: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
    },
    chatMessage: { count: jest.fn().mockResolvedValue(0) },
    paymentLog: { count: jest.fn().mockResolvedValue(0) },
    usageLog: { groupBy: jest.fn().mockResolvedValue([]) },
  },
}));

import '../../helpers/setup';
import { app } from '../../../src/app';
import { getAuthHeaders } from '../../helpers/auth.helper';

describe('RBAC Middleware', () => {
  it('should deny regular user access to admin metrics', async () => {
    const headers = await getAuthHeaders('GET', '/admin/metrics', '', {
      sub: 'user-1',
      email: 'user@test.com',
      role: 'USER',
    });

    const res = await request(app)
      .get('/admin/metrics')
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow admin access to admin metrics', async () => {
    const headers = await getAuthHeaders('GET', '/admin/metrics', '', {
      sub: 'admin-1',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    const res = await request(app)
      .get('/admin/metrics')
      .set(headers);

    expect(res.status).toBe(200);
  });

  it('should deny regular user access to subscription renewal (admin-only)', async () => {
    const body = {};
    const headers = await getAuthHeaders('POST', '/api/subscriptions/renew', body, {
      sub: 'user-1',
      email: 'user@test.com',
      role: 'USER',
    });

    const res = await request(app)
      .post('/api/subscriptions/renew')
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
  });
});
