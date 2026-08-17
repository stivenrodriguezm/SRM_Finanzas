import { AppError } from './AppError';

export interface AiFinancialPayload {
  cuentas: { nombre: string; balance: number; esDeuda: boolean }[];
  deudas: { nombre: string; tipo: 'debo' | 'me_deben'; total: number; restante: number; vence?: string }[];
  resumenMensual: { mes: string; ingresos: number; egresos: number; abonos: number; neto: number }[];
  transaccionesRecientes: { titulo: string; monto: number; tipo: string; fecha: string; cuenta: string }[];
}

export interface AiChart {
  type: 'bar' | 'pie' | 'line';
  title: string;
  description?: string;
  labels: string[];
  values: number[];
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface AiChatTurnResult {
  reply: string;
  charts?: AiChart[];
}

const CHAT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    charts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['bar', 'pie', 'line'] },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          labels: { type: 'ARRAY', items: { type: 'STRING' } },
          values: { type: 'ARRAY', items: { type: 'NUMBER' } },
        },
        required: ['type', 'title', 'labels', 'values'],
      },
    },
  },
  required: ['reply'],
};

const SYSTEM_INSTRUCTION = `Eres un asesor financiero personal conversacional. Chateas con un usuario sobre sus
finanzas reales (en pesos colombianos, COP).

En cada turno del usuario, al inicio de su mensaje vas a recibir un bloque "Datos financieros actuales
del usuario (JSON)" con su situación más reciente — úsalo siempre como la fuente de verdad para
cifras, incluso si el historial de la conversación menciona números distintos de antes (los datos
adjuntos en el turno actual son los correctos; pueden haber cambiado desde el último mensaje).

Datos disponibles en el JSON:
- "cuentas": cuentas con su balance actual ("esDeuda" indica si es un pasivo).
- "deudas": deudas activas con su monto restante y fecha de vencimiento.
- "resumenMensual": ingresos, egresos, abonos y flujo neto de los últimos 12 meses.
- "transaccionesRecientes": movimientos individuales recientes (título, monto, tipo, fecha, cuenta).

Instrucciones:
- Responde siempre en español, en tono natural y conversacional — esto es un chat, no un informe.
- Basa cada afirmación en los números reales del JSON — nunca inventes cifras.
- Si el usuario pide un análisis general (típicamente al iniciar la conversación), sé completo: cubre
  salud financiera general (¿está ahorrando o gastando de más?), distribución del dinero entre
  cuentas, peso de las deudas frente al ingreso, y patrones de gasto o fugas de dinero detectables en
  las transacciones recientes — cierra con recomendaciones concretas y priorizadas.
- Si el usuario hace una pregunta puntual de seguimiento, responde de forma breve y directa, como en
  una conversación real — no repitas todo el análisis anterior.
- "reply": el texto de tu respuesta (podés usar saltos de línea y guiones para listas simples).
- "charts": inclúyelo SOLO cuando una gráfica realmente ayude a responder (comparaciones, tendencias,
  composición) — no la fuerces en cada respuesta; omítelo o dejalo vacío si no aplica. Cuando la
  incluyas: "bar" para comparaciones o series cortas, "line" para tendencias en el tiempo, "pie" para
  composición/distribución. "labels" y "values" del mismo largo, valores numéricos reales derivados de
  los datos (no inventados), y un título claro.`;

/**
 * Llama a la API de Gemini para generar la siguiente respuesta del chat, dado el historial completo
 * de la conversación (el turno más reciente ya debe traer los datos financieros antepuestos por el
 * caller — ver analysisController.ts). Lanza AppError con mensajes en español listos para mostrar al
 * usuario si falta configuración, la llamada falla, o la respuesta no viene en el formato esperado —
 * nunca deja pasar un error crudo de la API externa.
 */
export const generateAiChatReply = async (contents: GeminiContent[]): Promise<AiChatTurnResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError('El análisis con IA no está configurado en el servidor (falta GEMINI_API_KEY).', 503);
  }

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', responseSchema: CHAT_RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(40000),
    });
  } catch (error) {
    console.error('[gemini] Error de red llamando a la API:', error);
    throw new AppError('No se pudo generar la respuesta con IA. Intenta de nuevo en un momento.', 502);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[gemini] La API respondió ${response.status}:`, errorBody);
    throw new AppError('No se pudo generar la respuesta con IA. Intenta de nuevo en un momento.', 502);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    console.error('[gemini] Respuesta sin el texto esperado:', JSON.stringify(data));
    throw new AppError('La IA no devolvió una respuesta válida. Intenta de nuevo.', 502);
  }

  try {
    return JSON.parse(text) as AiChatTurnResult;
  } catch (error) {
    console.error('[gemini] No se pudo parsear el JSON de la respuesta:', text);
    throw new AppError('La IA no devolvió una respuesta válida. Intenta de nuevo.', 502);
  }
};
