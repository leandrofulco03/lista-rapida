import { describe, expect, it } from 'vitest';
import { diasDesdeRespaldo, leerRespaldo, nombreArchivoRespaldo, tocaRecordarRespaldo, TABLAS_RESPALDO } from './respaldo';

const valido = () => ({
  app: 'lista-rapida',
  formato: 1,
  version: 2,
  fecha: '2026-10-12T12:00:00.000Z',
  tablas: Object.fromEntries(TABLAS_RESPALDO.map((t) => [t, t === 'config' ? [{ id: 'comercio' }] : []])) as Record<string, unknown[]>,
});

describe('leerRespaldo', () => {
  it('acepta una copia de esta versión o de una anterior', () => {
    expect(leerRespaldo(JSON.stringify(valido()), 2).ok).toBe(true);
    expect(leerRespaldo(JSON.stringify({ ...valido(), version: 1 }), 2).ok).toBe(true);
  });

  it.each([
    ['no es JSON', 'hola', 'El archivo no es una copia de seguridad de la app.'],
    ['es otro JSON', JSON.stringify({ a: 1 }), 'El archivo no es una copia de seguridad de la app.'],
    ['es de una versión más nueva', JSON.stringify({ ...valido(), version: 3 }), 'La copia se hizo con una versión más nueva de la app. Actualizá la app (recargá la página) y probá de nuevo.'],
    ['otro formato', JSON.stringify({ ...valido(), formato: 2 }), 'No reconocemos el formato de esta copia de seguridad.'],
    ['sin fecha', JSON.stringify({ ...valido(), fecha: 'ayer' }), 'La copia de seguridad está incompleta: no tiene fecha.'],
    ['le falta una tabla', JSON.stringify({ ...valido(), tablas: { ...valido().tablas, productos: undefined } }), 'La copia de seguridad está incompleta o dañada.'],
    ['una fila sin id', JSON.stringify({ ...valido(), tablas: { ...valido().tablas, rubros: [{ nombre: 'x' }] } }), 'La copia de seguridad está incompleta o dañada.'],
    ['sin configuración', JSON.stringify({ ...valido(), tablas: { ...valido().tablas, config: [] } }), 'La copia de seguridad no tiene la configuración del comercio.'],
  ])('rechaza si %s', (_, texto, error) => {
    expect(leerRespaldo(texto, 2)).toEqual({ ok: false, error });
  });
});

describe('recordatorio', () => {
  const ahora = new Date('2026-10-12T12:00:00Z');

  it('cuenta los días desde la última copia', () => {
    expect(diasDesdeRespaldo(null, ahora)).toBeNull();
    expect(diasDesdeRespaldo('2026-10-12T08:00:00Z', ahora)).toBe(0);
    expect(diasDesdeRespaldo('2026-10-05T12:00:00Z', ahora)).toBe(7);
  });

  it('recuerda si hay datos y nunca se hizo, o pasaron 7 días', () => {
    expect(tocaRecordarRespaldo(null, false, ahora)).toBe(false);
    expect(tocaRecordarRespaldo(null, true, ahora)).toBe(true);
    expect(tocaRecordarRespaldo('2026-10-06T12:00:00Z', true, ahora)).toBe(false);
    expect(tocaRecordarRespaldo('2026-10-05T12:00:00Z', true, ahora)).toBe(true);
  });
});

it('nombre del archivo con la fecha', () => {
  expect(nombreArchivoRespaldo(new Date(2026, 9, 2))).toBe('listamatch-respaldo-2026-10-02.json');
});
