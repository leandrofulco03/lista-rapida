import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MapeoColumnas } from '../domain/columnas';
import { BaseListaRapida } from './esquema';
import { crearProveedor, guardarLecturaProveedor, listarProveedores } from './proveedores';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-proveedores-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const MAPEO: MapeoColumnas = {
  filaEncabezado: 3,
  codigo: 0,
  descripcion: 1,
  costo: 3,
  presentacion: 2,
  titulos: { codigo: 'codigo', descripcion: 'descripcion', costo: 'precio', presentacion: 'presentacion' },
};

describe('proveedores (mínimo para la Fase 2)', () => {
  it('crea un proveedor sin mapeo y lo lista por nombre', async () => {
    await crearProveedor(db, '  Mayorista   Norte ', false, new Date('2026-10-12T12:00:00Z'));
    await crearProveedor(db, 'Distribuidora El Sol', true);
    const lista = await listarProveedores(db);
    expect(lista.map((p) => p.nombre)).toEqual(['Distribuidora El Sol', 'Mayorista Norte']);
    expect(lista[1]).toMatchObject({ mapeoColumnas: null, listaIncluyeIva: false, descuentosPct: [], creado: '2026-10-12T12:00:00.000Z' });
  });

  it('no duplica un proveedor con el mismo nombre', async () => {
    const a = await crearProveedor(db, 'El Sol', false);
    const b = await crearProveedor(db, 'el sol', true);
    expect(b.id).toBe(a.id);
    expect(await db.proveedores.count()).toBe(1);
  });

  it('rechaza nombres vacíos o muy largos', async () => {
    await expect(crearProveedor(db, '   ', false)).rejects.toThrow('Escribí el nombre');
    await expect(crearProveedor(db, 'x'.repeat(61), false)).rejects.toThrow('hasta 60');
  });

  it('F06: guarda el mapeo y si la lista trae IVA', async () => {
    const { id } = await crearProveedor(db, 'El Sol', false);
    await guardarLecturaProveedor(db, id, MAPEO, true);
    expect(await db.proveedores.get(id)).toMatchObject({ mapeoColumnas: MAPEO, listaIncluyeIva: true });
    // Guardar lo mismo otra vez no falla.
    await guardarLecturaProveedor(db, id, MAPEO, true);
    await expect(guardarLecturaProveedor(db, 999, MAPEO, true)).rejects.toThrow('No encontramos');
  });
});
