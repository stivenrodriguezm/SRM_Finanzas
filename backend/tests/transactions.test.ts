import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const createAccount = async (api: ReturnType<typeof authed>, balance = 1000) => {
  const res = await api.post('/api/accounts').send({ name: 'Cuenta', balance });
  return res.body;
};

describe('Transactions — balance de cuentas', () => {
  it('un ingreso aumenta el balance y un egreso lo reduce', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await createAccount(api, 1000);

    await api.post('/api/transactions').send({ account: account._id, title: 'Salario', amount: 500, type: 'ingreso' });
    await api.post('/api/transactions').send({ account: account._id, title: 'Mercado', amount: 200, type: 'egreso' });

    const updated = await api.get(`/api/accounts`);
    expect(updated.body[0].balance).toBe(1000 + 500 - 200);
  });

  it('rechaza montos negativos o en cero', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await createAccount(api);

    const res = await api.post('/api/transactions').send({ account: account._id, title: 'Malo', amount: -5, type: 'ingreso' });
    expect(res.status).toBe(400);
  });

  it('rechaza crear una transacción sobre una cuenta ajena', async () => {
    const { token: tokenA } = await createUser(app);
    const { token: tokenB } = await createUser(app);
    const account = await createAccount(authed(app, tokenA));

    const res = await authed(app, tokenB)
      .post('/api/transactions')
      .send({ account: account._id, title: 'Robo', amount: 50, type: 'ingreso' });
    expect(res.status).toBe(404);
  });

  it('borrar una transacción revierte el balance', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await createAccount(api, 1000);

    const tx = await api.post('/api/transactions').send({ account: account._id, title: 'Ingreso', amount: 300, type: 'ingreso' });
    let acc = await api.get('/api/accounts');
    expect(acc.body[0].balance).toBe(1300);

    await api.delete(`/api/transactions/${tx.body._id}`);
    acc = await api.get('/api/accounts');
    expect(acc.body[0].balance).toBe(1000);
  });

  it('editar el monto de una transacción recalcula el balance correctamente', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await createAccount(api, 1000);

    const tx = await api.post('/api/transactions').send({ account: account._id, title: 'Egreso', amount: 100, type: 'egreso' });
    let acc = await api.get('/api/accounts');
    expect(acc.body[0].balance).toBe(900);

    await api.put(`/api/transactions/${tx.body._id}`).send({ amount: 250 });
    acc = await api.get('/api/accounts');
    expect(acc.body[0].balance).toBe(750);
  });

  it('editar la cuenta de una transacción mueve el efecto entre cuentas', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const accountA = await createAccount(api, 1000);
    const accountB = await createAccount(api, 1000);

    const tx = await api.post('/api/transactions').send({ account: accountA._id, title: 'Ingreso', amount: 200, type: 'ingreso' });

    await api.put(`/api/transactions/${tx.body._id}`).send({ account: accountB._id });

    const accounts = await api.get('/api/accounts');
    const a = accounts.body.find((x: { _id: string }) => x._id === accountA._id);
    const b = accounts.body.find((x: { _id: string }) => x._id === accountB._id);
    expect(a.balance).toBe(1000);
    expect(b.balance).toBe(1200);
  });
});
