import request from 'supertest';
import { Express } from 'express';

interface RegisterOverrides {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
}

let counter = 0;

/** Registra un usuario nuevo (datos únicos por llamada) y devuelve { token, body }. */
export const createUser = async (app: Express, overrides: RegisterOverrides = {}) => {
  counter += 1;
  const payload = {
    name: 'Test User',
    username: `user${counter}_${Date.now()}`,
    email: `user${counter}_${Date.now()}@example.com`,
    password: 'password123',
    ...overrides,
  };

  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.token as string, body: res.body, payload };
};

export const authed = (app: Express, token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
  put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});
