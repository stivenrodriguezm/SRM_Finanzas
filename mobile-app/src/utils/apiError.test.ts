import { AxiosError } from 'axios';
import { getErrorMessage } from './apiError';

const makeAxiosError = (data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed');
  error.response = { data, status: 400, statusText: 'Bad Request', headers: {}, config: error.config as never };
  return error;
};

describe('getErrorMessage', () => {
  it('extrae el mensaje del backend cuando existe', () => {
    const error = makeAxiosError({ message: 'El correo ya está registrado' });
    expect(getErrorMessage(error)).toBe('El correo ya está registrado');
  });

  it('cae al mensaje propio del error si el backend no envía uno', () => {
    const error = makeAxiosError({});
    expect(getErrorMessage(error, 'Algo salió mal')).toBe('Request failed');
  });

  it('usa el mensaje del Error si no es un AxiosError', () => {
    expect(getErrorMessage(new Error('fallo de red'))).toBe('fallo de red');
  });

  it('usa el fallback por defecto para valores que no son Error', () => {
    expect(getErrorMessage('algo raro')).toBe('Ocurrió un error, intenta de nuevo');
  });
});
