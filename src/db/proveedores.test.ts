import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MapeoColumnas } from '../domain/columnas';
import { BaseListaRapida } from './esquema';
import {
  actualizarProveedor,
  borrarProveedor,
  crearProveedor,
  guardarLecturaProveedor,
  listarProveedores,
  olvidarColumnas,
} from './proveedores';

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

describe('F02: ficha del proveedor', () => {
  it('edita nombre, IVA y descuentos sin repetir nombres', async () => {
    const { id } = await crearProveedor(db, 'El Sol', false);
    await crearProveedor(db, 'Norte', false);
    const editado = await actualizarProveedor(db, id, { nombre: ' El Sol S.A. ', listaIncluyeIva: true, descuentosPct: [1000, 500] });
    expect(editado).toMatchObject({ nombre: 'El Sol S.A.', listaIncluyeIva: true, descuentosPct: [1000, 500] });
    await expect(actualizarProveedor(db, id, { nombre: 'norte', listaIncluyeIva: true, descuentosPct: [] })).rejects.toThrow(
      'Ya existe el proveedor Norte',
    );
    await expect(actualizarProveedor(db, id, { nombre: 'El Sol', listaIncluyeIva: true, descuentosPct: [10_000] })).rejects.toThrow(
      'entre 0% y 100%',
    );
  });

  it('olvida las columnas recordadas', async () => {
    const { id } = await crearProveedor(db, 'El Sol', false);
    await guardarLecturaProveedor(db, id, MAPEO, false);
    await olvidarColumnas(db, id);
    expect((await db.proveedores.get(id))?.mapeoColumnas).toBeNull();
  });

  it('la baja borra sus vínculos e importaciones, pero no los de otros proveedores', async () => {
    const sol = await crearProveedor(db, 'El Sol', false);
    const norte = await crearProveedor(db, 'Norte', false);
    const vinculo = { codigoProveedor: 'A1', descripcionProveedor: 'Yerba', productoId: 1, confirmado: true };
    await db.vinculos.bulkAdd([{ ...vinculo, proveedorId: sol.id }, { ...vinculo, proveedorId: norte.id }] as never);
    const importacion = await db.importaciones.add({
      proveedorId: sol.id,
      archivoNombre: 'lista.xlsx',
      fecha: '2026-10-12',
      totalLineas: 1,
      vinculadas: 1,
      estado: 'borrador',
    } as never);
    await db.lineasImportacion.add({ importacionId: importacion, estado: 'nueva' } as never);
    await borrarProveedor(db, sol.id);
    expect((await listarProveedores(db)).map((p) => p.nombre)).toEqual(['Norte']);
    expect((await db.vinculos.toArray()).map((v) => v.proveedorId)).toEqual([norte.id]);
    expect(await db.importaciones.count()).toBe(0);
    expect(await db.lineasImportacion.count()).toBe(0);
  });
});
