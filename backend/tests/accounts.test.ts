import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('Accounts', () => {
  it('crea y lista cuentas del usuario', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);

    const created = await api.post('/api/accounts').send({ name: 'Nu', balance: 1000 });
    expect(created.status).toBe(201);
    expect(created.body.balance).toBe(1000);

    const list = await api.get('/api/accounts');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('no permite editar/borrar una cuenta de otro usuario', async () => {
    const { token: tokenA } = await createUser(app);
    const { token: tokenB } = await createUser(app);

    const created = await authed(app, tokenA).post('/api/accounts').send({ name: 'Privada' });
    const accountId = created.body._id;

    const editAttempt = await authed(app, tokenB).put(`/api/accounts/${accountId}`).send({ name: 'Hackeada' });
    expect(editAttempt.status).toBe(401);

    const deleteAttempt = await authed(app, tokenB).delete(`/api/accounts/${accountId}`);
    expect(deleteAttempt.status).toBe(401);
  });

  it('rechaza crear una cuenta sin nombre', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token).post('/api/accounts').send({ balance: 100 });
    expect(res.status).toBe(400);
  });
});
