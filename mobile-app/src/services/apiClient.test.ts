import apiClient, { setAuthToken } from './apiClient';
import { API_URL } from '../config/api';

// Accede al interceptor de request directamente para no depender de red real.
// (Se usa `any` deliberadamente: son internals no tipados de axios, solo para este test.)
const runRequestInterceptor = (config: { headers: Record<string, unknown> }): { headers: Record<string, unknown> } => {
  const interceptors = apiClient.interceptors.request as unknown as {
    handlers: { fulfilled: (c: unknown) => unknown }[];
  };
  return interceptors.handlers[0].fulfilled(config) as { headers: Record<string, unknown> };
};

describe('apiClient', () => {
  afterEach(() => {
    setAuthToken(null);
  });

  it('usa la URL base configurada en config/api', () => {
    expect(apiClient.defaults.baseURL).toBe(API_URL);
  });

  it('no agrega Authorization cuando no hay token', () => {
    const config = runRequestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('agrega el Bearer token después de setAuthToken', () => {
    setAuthToken('mi-token-123');
    const config = runRequestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer mi-token-123');
  });

  it('deja de agregar el token después de setAuthToken(null) (logout)', () => {
    setAuthToken('mi-token-123');
    setAuthToken(null);
    const config = runRequestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});
