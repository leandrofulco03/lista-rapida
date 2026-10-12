import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectarColumnasCatalogo, extraerProductosCatalogo } from '../domain/catalogo';
import type { DatosProducto, ProductoArchivo } from '../domain/catalogo';
import { CONFIG_SUGERIDA } from '../domain/config';
import type { ConfigComercio } from '../domain/config';
import { leerArchivo } from '../parsers';
import {
  borrarProducto,
  borrarRubro,
  filtrarProductos,
  guardarProducto,
  guardarRubro,
  importarCatalogo,
  listarProductos,
  listarRubros,
  proponerCodigo,
} from './catalogo';
import { BaseListaRapida } from './esquema';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-catalogo-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const CONFIG: ConfigComercio = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' };
const AHORA = new Date('2026-10-12T12:00:00Z');

const yerba: DatosProducto = {
  codigoInterno: ' A1 ',
  descripcion: 'Yerba  Playadito 1 kg',
  rubroId: null,
  recargoPct: null,
  ivaPct: 2100,
  costoActual: 345_000,
  precioVentaActual: 549_000,
};

describe('rubros', () => {
  it('no repite nombres y al borrar un rubro sus productos quedan sin rubro', async () => {
    const almacen = await guardarRubro(db, { nombre: 'Almacén', recargoPct: 3500 });
    await expect(guardarRubro(db, { nombre: 'almacen', recargoPct: null })).rejects.toThrow('Ya existe el rubro Almacén');
    const producto = await guardarProducto(db, { ...yerba, rubroId: almacen.id }, undefined, AHORA);
    await borrarRubro(db, almacen.id);
    expect(await listarRubros(db)).toEqual([]);
    expect((await db.productos.get(producto.id))?.rubroId).toBeNull();
  });
});

describe('productos', () => {
  it('guarda limpio, con la descripción normalizada, y no repite códigos', async () => {
    const guardado = await guardarProducto(db, yerba, undefined, AHORA);
    expect(guardado).toMatchObject({ codigoInterno: 'A1', descripcion: 'Yerba Playadito 1 kg', descripcionNormalizada: 'yerba playadito 1000g' });
    await expect(guardarProducto(db, { ...yerba, codigoInterno: 'a1', descripcion: 'Otra' })).rejects.toThrow(
      'El código a1 ya es de Yerba Playadito 1 kg.',
    );
    // Editarse a sí mismo no choca con su propio código.
    await guardarProducto(db, { ...yerba, precioVentaActual: 600_000 }, guardado.id, AHORA);
    expect((await listarProductos(db)).map((p) => p.precioVentaActual)).toEqual([600_000]);
  });

  it('busca por palabras sueltas o código, sin acentos', async () => {
    await guardarProducto(db, yerba, undefined, AHORA);
    await guardarProducto(db, { ...yerba, codigoInterno: 'B7', descripcion: 'Café molido 250 g' }, undefined, AHORA);
    const productos = await listarProductos(db);
    expect(filtrarProductos(productos, 'cafe 250').map((p) => p.codigoInterno)).toEqual(['B7']);
    expect(filtrarProductos(productos, 'a1').map((p) => p.codigoInterno)).toEqual(['A1']);
    expect(filtrarProductos(productos, '')).toHaveLength(2);
  });

  it('al borrar un producto se borran sus vínculos', async () => {
    const producto = await guardarProducto(db, yerba, undefined, AHORA);
    await db.vinculos.add({ proveedorId: 1, codigoProveedor: 'X', descripcionProveedor: 'Yerba', productoId: producto.id, confirmado: true } as never);
    await borrarProducto(db, producto.id);
    expect(await db.vinculos.count()).toBe(0);
    expect(await db.productos.count()).toBe(0);
  });

  it('propone el próximo código libre', async () => {
    await guardarProducto(db, { ...yerba, codigoInterno: 'P0001' }, undefined, AHORA);
    expect(await proponerCodigo(db)).toBe('P0002');
  });
});

describe('importarCatalogo', () => {
  const archivo = (p: Partial<ProductoArchivo>): ProductoArchivo => ({
    codigo: null,
    descripcion: 'Producto',
    rubro: null,
    costo: null,
    precioVenta: null,
    ivaPct: null,
    filaOrigen: 1,
    ...p,
  });

  it('crea rubros, calcula el precio desde el costo y da códigos a los que no traen', async () => {
    const resultado = await importarCatalogo(
      db,
      [
        archivo({ codigo: 'A1', descripcion: 'Yerba 1 kg', rubro: 'Almacén', costo: 100_000, precioVenta: 170_000 }),
        // $ 1.000 + IVA 21% + recargo 30% = $ 1.573 → redondeo a $10: $ 1.580.
        archivo({ descripcion: 'Arroz 1 kg', rubro: 'almacen', costo: 100_000 }),
        archivo({ descripcion: 'Pan', rubro: 'Panadería', ivaPct: 1050 }),
      ],
      CONFIG,
      AHORA,
    );
    expect(resultado).toEqual({ creados: 3, actualizados: 0, rubrosCreados: 2 });
    const productos = await listarProductos(db);
    expect(productos.map((p) => [p.codigoInterno, p.descripcion, p.costoActual, p.precioVentaActual, p.ivaPct])).toEqual([
      ['P0001', 'Arroz 1 kg', 100_000, 158_000, 2100],
      ['P0002', 'Pan', 0, 0, 1050],
      ['A1', 'Yerba 1 kg', 100_000, 170_000, 2100],
    ]);
    expect((await listarRubros(db)).map((r) => r.nombre)).toEqual(['Almacén', 'Panadería']);
  });

  it('actualiza los que ya existen por código o, sin código, por descripción', async () => {
    const yerbaGuardada = await guardarProducto(db, { ...yerba, recargoPct: 5000 }, undefined, AHORA);
    await guardarProducto(db, { ...yerba, codigoInterno: 'X9', descripcion: 'Pan lactal' }, undefined, AHORA);
    const resultado = await importarCatalogo(
      db,
      [archivo({ codigo: 'a1', descripcion: 'Yerba Playadito 1 kg nueva', precioVenta: 600_000 }), archivo({ descripcion: 'PAN LACTAL', precioVenta: 250_000 })],
      CONFIG,
      AHORA,
    );
    expect(resultado).toEqual({ creados: 0, actualizados: 2, rubrosCreados: 0 });
    const actualizada = await db.productos.get(yerbaGuardada.id);
    // Se conservan el código, el costo y el recargo propio que no vinieron en el archivo.
    expect(actualizada).toMatchObject({ codigoInterno: 'a1', descripcion: 'Yerba Playadito 1 kg nueva', costoActual: 345_000, recargoPct: 5000, precioVentaActual: 600_000 });
    expect((await db.productos.where('codigoInterno').equals('X9').first())?.precioVentaActual).toBe(250_000);
  });

  it('carga 500 productos desde un Excel (condición de F03)', async () => {
    const carpeta = join(__dirname, '../../tests/fixtures/catalogo');
    const esperado = JSON.parse(readFileSync(join(carpeta, 'catalogo-500.xlsx.esperado.json'), 'utf-8'));
    const tabla = await leerArchivo('catalogo-500.xlsx', new Uint8Array(readFileSync(join(carpeta, 'catalogo-500.xlsx'))));
    const { mapeo, confianza } = detectarColumnasCatalogo(tabla.filas);
    expect(confianza).toBe('alta');
    const { productos, salteadas } = extraerProductosCatalogo(tabla.filas, mapeo!);
    expect(salteadas).toEqual([]);
    const resultado = await importarCatalogo(db, productos, CONFIG, AHORA);
    expect(resultado).toEqual({ creados: esperado.productos, actualizados: 0, rubrosCreados: esperado.rubros });
    const guardados = await listarProductos(db);
    expect(guardados).toHaveLength(500);
    expect(guardados.filter((p) => /^P\d{4}$/.test(p.codigoInterno))).toHaveLength(esperado.sinCodigo);
    expect(guardados.reduce((s, p) => s + p.precioVentaActual, 0)).toBe(esperado.sumaPrecioVenta);
    expect(new Set(guardados.map((p) => p.ivaPct))).toEqual(new Set([2100, 1050]));
  });
});
