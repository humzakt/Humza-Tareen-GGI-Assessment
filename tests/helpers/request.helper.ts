import request from 'supertest';
import { app } from '../../src/app';
import { getAuthHeaders } from './auth.helper';

export function getApp() {
  return app;
}

export async function authenticatedPost(
  path: string,
  body: object,
  userOverrides?: { sub?: string; email?: string; role?: string },
) {
  const headers = await getAuthHeaders('POST', path, body, userOverrides);
  return request(app)
    .post(path)
    .set(headers)
    .send(body);
}

export async function authenticatedGet(
  path: string,
  userOverrides?: { sub?: string; email?: string; role?: string },
) {
  const headers = await getAuthHeaders('GET', path, '', userOverrides);
  return request(app)
    .get(path)
    .set(headers);
}

export async function authenticatedPatch(
  path: string,
  body: object = {},
  userOverrides?: { sub?: string; email?: string; role?: string },
) {
  const headers = await getAuthHeaders('PATCH', path, body, userOverrides);
  return request(app)
    .patch(path)
    .set(headers)
    .send(body);
}

export function publicPost(path: string, body: object) {
  return request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .send(body);
}

export function publicGet(path: string) {
  return request(app).get(path);
}
