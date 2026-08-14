import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('Reminders', () => {
  it('pagar un recordatorio único crea una transacción, resta el balance y lo marca pagado', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const reminder = await api.post('/api/reminders').send({ title: 'Netflix', type: 'unico', date: new Date().toISOString() });

    const pay = await api.post(`/api/reminders/${reminder.body._id}/pay`).send({ amount: 45, accountId: account.body._id });
    expect(pay.status).toBe(200);
    expect(pay.body.reminder.isPaid).toBe(true);

    const accounts = await api.get('/api/accounts');
    expect(accounts.body[0].balance).toBe(955);

    const payments = await api.get(`/api/reminders/${reminder.body._id}/payments`);
    expect(payments.body).toHaveLength(1);
    expect(payments.body[0].amount).toBe(45);
  });

  it('pagar un recordatorio periódico avanza la fecha y no lo marca como pagado', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const reminder = await api.post('/api/reminders').send({ title: 'Arriendo', type: 'periodico', dayOfMonth: 5 });

    const originalDate = new Date(reminder.body.date);
    const pay = await api.post(`/api/reminders/${reminder.body._id}/pay`).send({ amount: 100, accountId: account.body._id });

    expect(pay.body.reminder.isPaid).toBe(false);
    expect(new Date(pay.body.reminder.date).getTime()).toBeGreaterThan(originalDate.getTime());
  });

  it('marcar como pagado un recordatorio único requiere fecha al crearlo', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token).post('/api/reminders').send({ title: 'Sin fecha', type: 'unico' });
    expect(res.status).toBe(400);
  });
});
