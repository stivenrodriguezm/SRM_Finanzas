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

  describe('Abono a cuenta de deuda', () => {
    it('descuenta el abono de la cuenta de deuda y de la cuenta de origen, y crea ambas transacciones', async () => {
      const { token } = await createUser(app);
      const api = authed(app, token);

      const debtAccount = await api.post('/api/accounts').send({ name: 'Tarjeta', balance: 100000, isLiability: true });
      const sourceAccount = await api.post('/api/accounts').send({ name: 'Nu', balance: 500000 });

      const res = await api.post(`/api/accounts/${debtAccount.body._id}/payment`).send({
        amount: 30000,
        sourceAccountId: sourceAccount.body._id,
      });
      expect(res.status).toBe(200);
      expect(res.body.account.balance).toBe(70000);

      const updatedSource = await api.get('/api/accounts');
      const source = updatedSource.body.find((a: { _id: string }) => a._id === sourceAccount.body._id);
      expect(source.balance).toBe(470000);

      const transactions = await api.get('/api/transactions');
      expect(transactions.body).toHaveLength(2);
      expect(transactions.body.map((t: { type: string }) => t.type).sort()).toEqual(['abono_deuda', 'egreso']);
    });

    it('si la cuenta de origen también es de deuda, pagar desde ella aumenta lo que se debe ahí', async () => {
      const { token } = await createUser(app);
      const api = authed(app, token);

      const debtAccount = await api.post('/api/accounts').send({ name: 'Tarjeta A', balance: 100000, isLiability: true });
      const sourceCard = await api.post('/api/accounts').send({ name: 'Tarjeta B', balance: 20000, isLiability: true });

      const res = await api.post(`/api/accounts/${debtAccount.body._id}/payment`).send({
        amount: 30000,
        sourceAccountId: sourceCard.body._id,
      });
      expect(res.status).toBe(200);
      expect(res.body.account.balance).toBe(70000);

      const updated = await api.get('/api/accounts');
      const source = updated.body.find((a: { _id: string }) => a._id === sourceCard.body._id);
      expect(source.balance).toBe(50000);
    });

    it('el abono nunca deja el balance de la deuda en negativo', async () => {
      const { token } = await createUser(app);
      const api = authed(app, token);

      const debtAccount = await api.post('/api/accounts').send({ name: 'Tarjeta', balance: 10000, isLiability: true });
      const sourceAccount = await api.post('/api/accounts').send({ name: 'Nu', balance: 500000 });

      const res = await api.post(`/api/accounts/${debtAccount.body._id}/payment`).send({
        amount: 50000,
        sourceAccountId: sourceAccount.body._id,
      });
      expect(res.status).toBe(200);
      expect(res.body.account.balance).toBe(0);
    });

    it('rechaza abonar a una cuenta que no es de deuda', async () => {
      const { token } = await createUser(app);
      const api = authed(app, token);

      const normalAccount = await api.post('/api/accounts').send({ name: 'Ahorros', balance: 100000 });
      const sourceAccount = await api.post('/api/accounts').send({ name: 'Nu', balance: 500000 });

      const res = await api.post(`/api/accounts/${normalAccount.body._id}/payment`).send({
        amount: 10000,
        sourceAccountId: sourceAccount.body._id,
      });
      expect(res.status).toBe(400);
    });

    it('rechaza abonar usando la misma cuenta de deuda como origen', async () => {
      const { token } = await createUser(app);
      const api = authed(app, token);

      const debtAccount = await api.post('/api/accounts').send({ name: 'Tarjeta', balance: 100000, isLiability: true });

      const res = await api.post(`/api/accounts/${debtAccount.body._id}/payment`).send({
        amount: 10000,
        sourceAccountId: debtAccount.body._id,
      });
      expect(res.status).toBe(400);
    });

    it('no permite abonar a la cuenta de deuda de otro usuario', async () => {
      const { token: tokenA } = await createUser(app);
      const { token: tokenB } = await createUser(app);

      const debtAccount = await authed(app, tokenA).post('/api/accounts').send({ name: 'Tarjeta', balance: 100000, isLiability: true });
      const sourceAccount = await authed(app, tokenB).post('/api/accounts').send({ name: 'Nu', balance: 500000 });

      const res = await authed(app, tokenB).post(`/api/accounts/${debtAccount.body._id}/payment`).send({
        amount: 10000,
        sourceAccountId: sourceAccount.body._id,
      });
      expect(res.status).toBe(404);
    });
  });
});
