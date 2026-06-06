import request from 'supertest';

jest.mock('../../../src/lib/prisma/client', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

import '../../helpers/setup';
import { app } from '../../../src/app';
import { getAuthHeaders } from '../../helpers/auth.helper';

describe('Input Validation', () => {
  describe('Auth registration', () => {
    it('should reject registration without email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send({ password: 'test123', name: 'Test' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.stringContaining('email') }),
        ]),
      );
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send({ email: 'not-an-email', password: 'test123', name: 'Test' });

      expect(res.status).toBe(422);
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@test.com', password: '12', name: 'Test' });

      expect(res.status).toBe(422);
    });

    it('should reject unknown fields (strict mode)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@test.com', password: 'test123', name: 'Test', unknownField: 'hack' });

      expect(res.status).toBe(422);
    });
  });

  describe('Chat endpoint validation', () => {
    it('should reject chat without question', async () => {
      const headers = await getAuthHeaders('POST', '/api/chat', {});
      const res = await request(app)
        .post('/api/chat')
        .set(headers)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject chat with empty question', async () => {
      const body = { question: '' };
      const headers = await getAuthHeaders('POST', '/api/chat', body);
      const res = await request(app)
        .post('/api/chat')
        .set(headers)
        .send(body);

      expect(res.status).toBe(422);
    });
  });
});
