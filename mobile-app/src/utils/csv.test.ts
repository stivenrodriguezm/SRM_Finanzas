import { toCsv, toCsvValue } from './csv';

describe('toCsvValue', () => {
  it('deja pasar valores simples sin comillas', () => {
    expect(toCsvValue('hola')).toBe('hola');
    expect(toCsvValue(123)).toBe('123');
  });

  it('convierte null/undefined en cadena vacía', () => {
    expect(toCsvValue(null)).toBe('');
    expect(toCsvValue(undefined)).toBe('');
  });

  it('envuelve en comillas y escapa valores con coma, comillas o salto de línea', () => {
    expect(toCsvValue('Pago, Netflix')).toBe('"Pago, Netflix"');
    expect(toCsvValue('Dice "hola"')).toBe('"Dice ""hola"""');
    expect(toCsvValue('línea1\nlínea2')).toBe('"línea1\nlínea2"');
  });
});

describe('toCsv', () => {
  it('genera encabezado y filas separadas por coma', () => {
    const csv = toCsv(['a', 'b'], [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(csv).toBe('a,b\n1,x\n2,y');
  });

  it('escapa correctamente valores con coma dentro de una fila real', () => {
    const csv = toCsv(['titulo', 'monto'], [{ titulo: 'Mercado, quincena', monto: 50000 }]);
    expect(csv).toBe('titulo,monto\n"Mercado, quincena",50000');
  });

  it('devuelve solo el encabezado cuando no hay filas', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });
});
