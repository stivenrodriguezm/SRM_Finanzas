import request from 'supertest';
import app from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './testDb';
import { createUser, authed } from './helpers';
import { generateAiChatReply, AiChatTurnResult } from '../src/utils/geminiClient';
import { AppError } from '../src/utils/AppError';

jest.mock('../src/utils/geminiClient', () => ({
  generateAiChatReply: jest.fn(),
}));

const mockedGenerateAiChatReply = generateAiChatReply as jest.MockedFunction<typeof generateAiChatReply>;

beforeAll(connectTestDB);
afterEach(async () => {
  await clearTestDB();
  mockedGenerateAiChatReply.mockReset();
});
afterAll(closeTestDB);

const fakeReply = (text: string): AiChatTurnResult => ({ reply: text });

describe('POST /api/analysis/chats', () => {
  it('requiere autenticación', async () => {
    const res = await request(app).post('/api/analysis/chats').send({});
    expect(res.status).toBe(401);
  });

  it('crea el chat con el mensaje de arranque y la respuesta de la IA', async () => {
    const { token } = await createUser(app);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Tu situación financiera es estable.'));

    const res = await authed(app, token).post('/api/analysis/chats').send({});

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Tu situación financiera es estable');
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].role).toBe('user');
    expect(res.body.messages[0].text).toBe('Haz un análisis general de mis finanzas.');
    expect(res.body.messages[1].role).toBe('model');
    expect(res.body.messages[1].text).toBe('Tu situación financiera es estable.');

    expect(mockedGenerateAiChatReply).toHaveBeenCalledTimes(1);
    const [contents] = mockedGenerateAiChatReply.mock.calls[0];
    expect(contents).toHaveLength(1);
    expect(contents[0].role).toBe('user');
    expect(contents[0].parts[0].text).toContain('Haz un análisis general de mis finanzas.');
    expect(contents[0].parts[0].text).toContain('Datos financieros actuales del usuario (JSON)');
  });

  it('propaga el error cuando la IA no está configurada', async () => {
    const { token } = await createUser(app);
    mockedGenerateAiChatReply.mockRejectedValue(
      new AppError('El análisis con IA no está configurado en el servidor (falta GEMINI_API_KEY).', 503)
    );

    const res = await authed(app, token).post('/api/analysis/chats').send({});
    expect(res.status).toBe(503);
  });
});

describe('GET /api/analysis/chats', () => {
  it('lista los chats del usuario más recientes primero, sin traer los de otro usuario', async () => {
    const { token } = await createUser(app);
    const { token: otherToken } = await createUser(app);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis 1'));
    await authed(app, token).post('/api/analysis/chats').send({});
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis 2'));
    await authed(app, token).post('/api/analysis/chats').send({});
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis de otro usuario'));
    await authed(app, otherToken).post('/api/analysis/chats').send({});

    const res = await authed(app, token).get('/api/analysis/chats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/analysis/chats/:id', () => {
  it('devuelve 401 si el chat no es del usuario autenticado', async () => {
    const { token } = await createUser(app);
    const { token: otherToken } = await createUser(app);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis'));
    const created = await authed(app, token).post('/api/analysis/chats').send({});

    const res = await authed(app, otherToken).get(`/api/analysis/chats/${created.body._id}`);
    expect(res.status).toBe(401);
  });

  it('devuelve 404 si el chat no existe', async () => {
    const { token } = await createUser(app);
    const res = await authed(app, token).get('/api/analysis/chats/64b000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/analysis/chats/:id/messages', () => {
  it('lleva el contexto de la conversación en los turnos siguientes', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Gastas mucho en mercado.'));
    const created = await api.post('/api/analysis/chats').send({});
    const chatId = created.body._id;

    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('El mes pasado gastaste 200.000 en mercado.'));
    const res = await api.post(`/api/analysis/chats/${chatId}/messages`).send({ text: '¿Y en mercado específicamente?' });

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(4);
    expect(res.body.messages[2].text).toBe('¿Y en mercado específicamente?');
    expect(res.body.messages[3].text).toBe('El mes pasado gastaste 200.000 en mercado.');

    const [contents] = mockedGenerateAiChatReply.mock.calls[1];
    expect(contents).toHaveLength(3); // kickoff user + kickoff model + turno nuevo
    expect(contents[0].parts[0].text).toContain('Haz un análisis general de mis finanzas.');
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts[0].text).toBe('Gastas mucho en mercado.');
    expect(contents[2].role).toBe('user');
    expect(contents[2].parts[0].text).toContain('¿Y en mercado específicamente?');
    expect(contents[2].parts[0].text).toContain('Datos financieros actuales del usuario (JSON)');
  });

  it('rechaza un mensaje vacío', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis'));
    const created = await api.post('/api/analysis/chats').send({});

    const res = await api.post(`/api/analysis/chats/${created.body._id}/messages`).send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('devuelve 401 si el chat no es del usuario', async () => {
    const { token } = await createUser(app);
    const { token: otherToken } = await createUser(app);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis'));
    const created = await authed(app, token).post('/api/analysis/chats').send({});

    const res = await authed(app, otherToken)
      .post(`/api/analysis/chats/${created.body._id}/messages`)
      .send({ text: 'hola' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/analysis/chats/:id', () => {
  it('borra el chat del dueño y ya no aparece en la lista', async () => {
    const { token } = await createUser(app);
    const api = authed(app, token);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis'));
    const created = await api.post('/api/analysis/chats').send({});

    const del = await api.delete(`/api/analysis/chats/${created.body._id}`);
    expect(del.status).toBe(200);

    const list = await api.get('/api/analysis/chats');
    expect(list.body).toHaveLength(0);
  });

  it('devuelve 401 si el chat no es del usuario', async () => {
    const { token } = await createUser(app);
    const { token: otherToken } = await createUser(app);
    mockedGenerateAiChatReply.mockResolvedValue(fakeReply('Análisis'));
    const created = await authed(app, token).post('/api/analysis/chats').send({});

    const res = await authed(app, otherToken).delete(`/api/analysis/chats/${created.body._id}`);
    expect(res.status).toBe(401);
  });
});
