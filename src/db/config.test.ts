import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { guardarConfig, leerConfig } from './config';
import { BaseListaRapida, TABLAS } from './esquema';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('esquema Dexie', () => {
  it('tiene las 8 tablas del modelo de datos', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLAS].sort());
  });

  it('los descuentos del proveedor se guardan como lista', async () => {
    const id = await db.proveedores.add({
      nombre: 'Distribuidora Sur',
      mapeoColumnas: null,
      listaIncluyeIva: false,
      descuentosPct: [1000, 500],
      creado: '2026-10-12T00:00:00.000Z',
    });
    expect((await db.proveedores.get(id))?.descuentosPct).toEqual([1000, 500]);
  });
});

describe('F01: leerConfig y guardarConfig', () => {
  it('sin configurar devuelve undefined', async () => {
    expect(await leerConfig(db)).toBeUndefined();
  });

  it('guarda y vuelve a leer la configuración, con el nombre limpio', async () => {
    await guardarConfig(db, { ...CONFIG_SUGERIDA, nombreComercio: '  Kiosco  Luli ' });
    expect(await leerConfig(db)).toEqual({ ...CONFIG_SUGERIDA, nombreComercio: 'Kiosco Luli' });
  });

  it('guardar dos veces deja una sola fila', async () => {
    await guardarConfig(db, { ...CONFIG_SUGERIDA, nombreComercio: 'Uno' });
    await guardarConfig(db, { ...CONFIG_SUGERIDA, nombreComercio: 'Dos', recargoGeneral: 4000 });
    expect(await db.config.count()).toBe(1);
    expect(await leerConfig(db)).toMatchObject({ nombreComercio: 'Dos', recargoGeneral: 4000 });
  });

  it('no guarda una configuración inválida', async () => {
    await expect(guardarConfig(db, { ...CONFIG_SUGERIDA, nombreComercio: '' })).rejects.toThrow('Configuración inválida');
    expect(await leerConfig(db)).toBeUndefined();
  });
});
