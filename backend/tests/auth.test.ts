jest.mock('../src/utils/sendEmail', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';
import { sendEmail } from '../src/utils/sendEmail';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('Auth', () => {
  it('registra un usuario y devuelve token', async () => {
    const { token, body } = await createUser(app, { email: 'ana@example.com', username: 'ana' });
    expect(token).toBeDefined();
    expect(body.email).toBe('ana@example.com');
    expect(body.password).toBeUndefined();
  });

  it('rechaza un registro con contraseña muy corta', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', username: 'xx', email: 'x@example.com', password: '123',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza email duplicado', async () => {
    await createUser(app, { email: 'dup@example.com', username: 'dup1' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Otro', username: 'dup2', email: 'dup@example.com', password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('permite login con credenciales correctas y lo rechaza con incorrectas', async () => {
    const { payload } = await createUser(app, { email: 'login@example.com', username: 'loginuser' });

    const ok = await request(app).post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();

    const bad = await request(app).post('/api/auth/login').send({ email: payload.email, password: 'wrongpass' });
    expect(bad.status).toBe(401);
    expect(bad.body.message).not.toMatch(/mongo|bcrypt|stack/i);
  });

  it('recupera la contraseña con el código enviado por correo', async () => {
    const { payload } = await createUser(app, { email: 'reset@example.com', username: 'resetuser' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: payload.email });
    expect(forgot.status).toBe(200);

    const html = (sendEmail as jest.Mock).mock.calls.at(-1)?.[2] as string;
    const code = html.match(/(\d{6})/)?.[1];
    expect(code).toBeDefined();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: payload.email, code, newPassword: 'nuevaPassword123' });
    expect(reset.status).toBe(200);

    const loginOld = await request(app).post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/api/auth/login').send({ email: payload.email, password: 'nuevaPassword123' });
    expect(loginNew.status).toBe(200);
  });

  it('rechaza un código de recuperación incorrecto', async () => {
    const { payload } = await createUser(app, { email: 'badcode@example.com', username: 'badcodeuser' });
    await request(app).post('/api/auth/forgot-password').send({ email: payload.email });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: payload.email, code: '000000', newPassword: 'nuevaPassword123' });
    expect(res.status).toBe(400);
  });

  it('responde genérico en forgot-password aunque el correo no exista (no revela usuarios)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'noexiste@example.com' });
    expect(res.status).toBe(200);
  });

  it('guarda el orden personalizado de recordatorios y deudas por separado', async () => {
    const { token, body } = await createUser(app, { email: 'orden@example.com', username: 'ordenuser' });
    expect(body.preferences.reminderOrder).toEqual([]);
    expect(body.preferences.debtOrder).toEqual([]);

    const res = await authed(app, token)
      .put('/api/auth/preferences')
      .send({ reminderOrder: ['r2', 'r1'], debtOrder: ['d2', 'd1'] });

    expect(res.status).toBe(200);
    expect(res.body.preferences.reminderOrder).toEqual(['r2', 'r1']);
    expect(res.body.preferences.debtOrder).toEqual(['d2', 'd1']);
    // No se pisan entre sí ni afectan otras preferencias
    expect(res.body.preferences.accountOrder).toEqual([]);
  });
});
