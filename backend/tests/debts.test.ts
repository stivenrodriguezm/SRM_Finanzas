import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('Debts — abonos y balance', () => {
  it('abonar a una deuda "debo" reduce remainingAmount y resta del balance', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });

    const debt = await api.post('/api/debts').send({ name: 'Tarjeta', totalAmount: 500, type: 'debo' });
    expect(debt.body.remainingAmount).toBe(500);

    const payment = await api
      .post(`/api/debts/${debt.body._id}/payment`)
      .send({ amount: 200, accountId: account.body._id });
    expect(payment.status).toBe(200);
    expect(payment.body.debt.remainingAmount).toBe(300);

    const accounts = await api.get('/api/accounts');
    expect(accounts.body[0].balance).toBe(800);
  });

  it('abonar a una deuda "me_deben" suma al balance', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const debt = await api.post('/api/debts').send({ name: 'Préstamo a Juan', totalAmount: 300, type: 'me_deben' });

    await api.post(`/api/debts/${debt.body._id}/payment`).send({ amount: 300, accountId: account.body._id });

    const accounts = await api.get('/api/accounts');
    expect(accounts.body[0].balance).toBe(1300);

    const updatedDebt = await api.get(`/api/debts/${debt.body._id}`);
    expect(updatedDebt.body.remainingAmount).toBe(0);
    expect(updatedDebt.body.isActive).toBe(false);
  });

  it('el historial de abonos queda ligado a la deuda por ID', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const debtA = await api.post('/api/debts').send({ name: 'Juan', totalAmount: 200, type: 'debo' });
    const debtB = await api.post('/api/debts').send({ name: 'Juan Pablo', totalAmount: 200, type: 'debo' });

    await api.post(`/api/debts/${debtA.body._id}/payment`).send({ amount: 50, accountId: account.body._id });
    await api.post(`/api/debts/${debtB.body._id}/payment`).send({ amount: 60, accountId: account.body._id });

    const txsA = await api.get(`/api/debts/${debtA.body._id}/transactions`);
    expect(txsA.body).toHaveLength(1);
    expect(txsA.body[0].amount).toBe(50);

    const txsB = await api.get(`/api/debts/${debtB.body._id}/transactions`);
    expect(txsB.body).toHaveLength(1);
    expect(txsB.body[0].amount).toBe(60);
  });
});
