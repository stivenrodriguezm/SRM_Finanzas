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

  it('pagar un recordatorio con una cuenta de deuda aumenta lo que se debe, no lo reduce', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const card = await api.post('/api/accounts').send({ name: 'Tarjeta', balance: 90_000_000, isLiability: true });
    const reminder = await api.post('/api/reminders').send({ title: 'Servicios', type: 'unico', date: new Date().toISOString() });

    const pay = await api
      .post(`/api/reminders/${reminder.body._id}/pay`)
      .send({ amount: 127_500, accountId: card.body._id });
    expect(pay.status).toBe(200);

    const accounts = await api.get('/api/accounts');
    expect(accounts.body[0].balance).toBe(90_127_500);
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

  it('crear un recordatorio sin notificationConfig aplica los defaults', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token)
      .post('/api/reminders')
      .send({ title: 'Netflix', type: 'unico', date: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.notificationConfig).toMatchObject({
      mode: 'default',
      daysBefore: 1,
      hour: 9,
      startHour: 8,
      endHour: 21,
      initialIntervalMinutes: 120,
      minIntervalMinutes: 60,
    });
  });

  it('crear un recordatorio con notificationConfig personalizado lo persiste', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token)
      .post('/api/reminders')
      .send({
        title: 'Arriendo',
        type: 'unico',
        date: new Date().toISOString(),
        notificationConfig: {
          mode: 'escalating',
          startHour: 7,
          endHour: 22,
          initialIntervalMinutes: 120,
          minIntervalMinutes: 30,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.notificationConfig).toMatchObject({
      mode: 'escalating',
      startHour: 7,
      endHour: 22,
      initialIntervalMinutes: 120,
      minIntervalMinutes: 30,
    });
  });

  it('rechaza notificationConfig inválido (endHour <= startHour)', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token)
      .post('/api/reminders')
      .send({
        title: 'Arriendo',
        type: 'unico',
        date: new Date().toISOString(),
        notificationConfig: { mode: 'escalating', startHour: 20, endHour: 10 },
      });

    expect(res.status).toBe(400);
  });

  it('PUT /:id guarda snoozedUntil, y pagar lo limpia', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const account = await api.post('/api/accounts').send({ name: 'Cuenta', balance: 1000 });
    const reminder = await api.post('/api/reminders').send({ title: 'Netflix', type: 'unico', date: new Date().toISOString() });

    const snoozeDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await api.put(`/api/reminders/${reminder.body._id}`).send({ snoozedUntil: snoozeDate });
    expect(updated.status).toBe(200);
    expect(new Date(updated.body.snoozedUntil).getTime()).toBe(new Date(snoozeDate).getTime());

    const pay = await api
      .post(`/api/reminders/${reminder.body._id}/pay`)
      .send({ amount: 45, accountId: account.body._id });
    expect(pay.body.reminder.snoozedUntil).toBeFalsy();
  });

  it('mark-paid también limpia snoozedUntil', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const reminder = await api.post('/api/reminders').send({ title: 'Netflix', type: 'unico', date: new Date().toISOString() });

    const snoozeDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await api.put(`/api/reminders/${reminder.body._id}`).send({ snoozedUntil: snoozeDate });

    const marked = await api.put(`/api/reminders/${reminder.body._id}/mark-paid`);
    expect(marked.body.snoozedUntil).toBeFalsy();
  });

  it('PUT /:id no cambia isPaid aunque venga en el body — solo /mark-paid y /pay pueden marcarlo pagado', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const reminder = await api.post('/api/reminders').send({ title: 'Netflix', type: 'unico', date: new Date().toISOString() });
    expect(reminder.body.isPaid).toBe(false);

    const updated = await api.put(`/api/reminders/${reminder.body._id}`).send({ isPaid: true, title: 'Netflix Premium' });
    expect(updated.status).toBe(200);
    expect(updated.body.isPaid).toBe(false);
    expect(updated.body.title).toBe('Netflix Premium');
  });

  it('PUT /:id que solo cambia notificationConfig no toca la fecha de un recordatorio periódico', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const reminder = await api.post('/api/reminders').send({
      title: 'Arriendo',
      type: 'periodico',
      date: new Date(2026, 5, 15).toISOString(),
      dayOfMonth: 15,
    });
    const originalDate = reminder.body.date;

    const updated = await api
      .put(`/api/reminders/${reminder.body._id}`)
      .send({ notificationConfig: { mode: 'off' } });
    expect(updated.status).toBe(200);
    expect(new Date(updated.body.date).getTime()).toBe(new Date(originalDate).getTime());
    expect(updated.body.isPaid).toBe(false);
  });

  it('crear un recordatorio periódico para hoy no lo adelanta un mes', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    const today = new Date();

    const reminder = await api.post('/api/reminders').send({ title: 'Hoy mismo', type: 'periodico', dayOfMonth: today.getDate() });
    expect(reminder.status).toBe(201);
    const savedDate = new Date(reminder.body.date);
    expect(savedDate.getFullYear()).toBe(today.getFullYear());
    expect(savedDate.getMonth()).toBe(today.getMonth());
    expect(savedDate.getDate()).toBe(today.getDate());
  });
});
