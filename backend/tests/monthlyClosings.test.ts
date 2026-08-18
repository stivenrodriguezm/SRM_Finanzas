import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('Cierres mensuales (Histórico)', () => {
  it('capturar arma el snapshot de cuentas y calcula el patrimonio neto', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);

    await api.post('/api/accounts').send({ name: 'Nequi', balance: 850000 });
    await api.post('/api/accounts').send({ name: 'Tarjeta', balance: 200000, isLiability: true });

    const res = await api.post('/api/monthly-closings').send({ period: '2026-08' });
    expect(res.status).toBe(201);
    expect(res.body.period).toBe('2026-08');
    expect(res.body.accounts).toHaveLength(2);
    expect(res.body.netWorth).toBe(850000 - 200000);
    expect(res.body.isAutomatic).toBe(false);
  });

  it('capturar el mismo período dos veces no duplica (idempotente)', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });

    const first = await api.post('/api/monthly-closings').send({ period: '2026-08' });
    expect(first.status).toBe(201);

    const second = await api.post('/api/monthly-closings').send({ period: '2026-08' });
    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);

    const list = await api.get('/api/monthly-closings');
    expect(list.body).toHaveLength(1);
  });

  it('editar recalcula el patrimonio neto y marca el cierre como manual', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const closing = await api.post('/api/monthly-closings').send({ period: '2026-08' });

    const updated = await api
      .put(`/api/monthly-closings/${closing.body.period}`)
      .send({ accounts: [{ account: account.body._id, balance: 5000 }], note: 'Ajuste manual' });

    expect(updated.status).toBe(200);
    expect(updated.body.netWorth).toBe(5000);
    expect(updated.body.accounts[0].balance).toBe(5000);
    expect(updated.body.isAutomatic).toBe(false);
    expect(updated.body.note).toBe('Ajuste manual');
  });

  it('editar con una cuenta que no pertenece al cierre falla con 400', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const closing = await api.post('/api/monthly-closings').send({ period: '2026-08' });

    const res = await api
      .put(`/api/monthly-closings/${closing.body.period}`)
      .send({ accounts: [{ account: '507f1f77bcf86cd799439011', balance: 1 }] });

    expect(res.status).toBe(400);
  });

  it('un usuario no puede ver, editar ni borrar el cierre de otro', async () => {
    const owner = await createUser(app);
    const ownerApi = authed(app, owner.token);
    await ownerApi.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const closing = await ownerApi.post('/api/monthly-closings').send({ period: '2026-08' });

    const other = await createUser(app);
    const otherApi = authed(app, other.token);

    const get = await otherApi.get(`/api/monthly-closings/${closing.body.period}`);
    expect(get.status).toBe(404);

    const put = await otherApi.put(`/api/monthly-closings/${closing.body.period}`).send({ accounts: [] });
    expect([400, 404]).toContain(put.status);

    const del = await otherApi.delete(`/api/monthly-closings/${closing.body.period}`);
    expect(del.status).toBe(404);
  });

  it('lista los cierres ordenados por período descendente', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });

    await api.post('/api/monthly-closings').send({ period: '2026-06' });
    await api.post('/api/monthly-closings').send({ period: '2026-08' });
    await api.post('/api/monthly-closings').send({ period: '2026-07' });

    const list = await api.get('/api/monthly-closings');
    expect(list.body.map((c: { period: string }) => c.period)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('borrar un cierre lo elimina', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const closing = await api.post('/api/monthly-closings').send({ period: '2026-08' });

    const del = await api.delete(`/api/monthly-closings/${closing.body.period}`);
    expect(del.status).toBe(200);

    const get = await api.get(`/api/monthly-closings/${closing.body.period}`);
    expect(get.status).toBe(404);
  });
});
