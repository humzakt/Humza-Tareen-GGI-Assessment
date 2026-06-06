import request from 'supertest';

jest.mock('../../../src/lib/prisma/client', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

import '../../helpers/setup';
import { app } from '../../../src/app';
import { generateTestToken, generateHmacSignature } from '../../helpers/auth.helper';

describe('Security Middleware', () => {
  describe('Content-Type Validation', () => {
    it('should reject POST without Content-Type application/json', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'text/plain')
        .send('hello');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTENT_TYPE');
    });

    it('should allow GET requests without Content-Type', async () => {
      const res = await request(app).get('/health');
      expect(res.status).not.toBe(400);
    });
  });

  describe('Request Size Limit', () => {
    it('should reject oversized bodies', async () => {
      const largeBody = JSON.stringify({ question: 'x'.repeat(11000) });
      const res = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send(largeBody);

      expect([413, 500]).toContain(res.status);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      const timestamp = Date.now().toString();
      const signature = generateHmacSignature('POST', '/api/chat', '{"question":"test"}', Date.now());

      const res = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .set('x-request-timestamp', timestamp)
        .set('x-request-signature', signature)
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject expired tokens', async () => {
      const token = await generateTestToken({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'USER',
        expired: true,
      });

      const timestamp = Date.now();
      const body = JSON.stringify({ question: 'test' });
      const signature = generateHmacSignature('POST', '/api/chat', body, timestamp);

      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .set('x-request-timestamp', timestamp.toString())
        .set('x-request-signature', signature)
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject invalid tokens', async () => {
      const timestamp = Date.now();
      const body = JSON.stringify({ question: 'test' });
      const signature = generateHmacSignature('POST', '/api/chat', body, timestamp);

      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', 'Bearer invalid.token.here')
        .set('Content-Type', 'application/json')
        .set('x-request-timestamp', timestamp.toString())
        .set('x-request-signature', signature)
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('HMAC Signature Verification', () => {
    it('should reject requests without timestamp header', async () => {
      const token = await generateTestToken({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'USER',
      });

      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TIMESTAMP_EXPIRED');
    });

    it('should reject requests with stale timestamps', async () => {
      const token = await generateTestToken({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'USER',
      });
      const staleTimestamp = Date.now() - 6 * 60 * 1000;
      const body = JSON.stringify({ question: 'test' });
      const signature = generateHmacSignature('POST', '/api/chat', body, staleTimestamp);

      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .set('x-request-timestamp', staleTimestamp.toString())
        .set('x-request-signature', signature)
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TIMESTAMP_EXPIRED');
    });

    it('should reject requests with invalid signature', async () => {
      const token = await generateTestToken({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'USER',
      });
      const timestamp = Date.now();

      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .set('x-request-timestamp', timestamp.toString())
        .set('x-request-signature', 'a'.repeat(64))
        .send({ question: 'test' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('Correlation ID', () => {
    it('should return correlation ID in response headers', async () => {
      const res = await request(app)
        .get('/health')
        .set('x-correlation-id', 'test-correlation-123');

      expect(res.headers['x-correlation-id']).toBe('test-correlation-123');
    });

    it('should generate correlation ID if not provided', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(String(res.headers['x-correlation-id']).length).toBeGreaterThan(0);
    });

    it('should return request ID in response headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });
});
