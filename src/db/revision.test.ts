import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { armarRevision } from '../domain/revision';
import { guardarProducto, listarProductos } from './catalogo';
import { BaseListaRapida } from './esquema';
import { crearProveedor } from './proveedores';
import { aplicarRevision } from './revision';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-revision-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const config = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' };
const AHORA = new Date('2026-10-12T12:00:00Z');

it('guarda sólo lo aprobado, con historial, y deja la importación con todas sus líneas', async () => {
  const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
  const datos = { rubroId: null, recargoPct: null, ivaPct: 2100, precioVentaActual: 160_000 };
  const yerba = await guardarProducto(db, { ...datos, codigoInterno: 'Y', descripcion: 'Yerba', costoActual: 100_000 });
  const aceite = await guardarProducto(db, { ...datos, codigoInterno: 'A', descripcion: 'Aceite', costoActual: 100_000 });
  const linea = (fila: number, costo: number) => ({ codigo: null, descripcion: `L${fila}`, presentacion: null, costo, ivaIncluido: null, filaOrigen: fila });

  const productos = await listarProductos(db);
  const { cambios } = armarRevision({
    lineas: [
      { linea: linea(1, 110_000), productoId: yerba.id },
      { linea: linea(2, 90_000), productoId: aceite.id },
    ],
    productos: new Map(productos.map((p) => [p.id, p])),
    recargosRubro: new Map(),
    vinculadosAntes: new Set(),
    listaIncluyeIva: false,
    descuentos: [],
    config,
  });

  const resultado = await aplicarRevision(
    db,
    { proveedorId, archivo: 'el-sol.xlsx', totalLineas: 2, cambios, decisiones: new Map([[yerba.id, { precio: 174_000 }]]) },
    AHORA,
  );

  expect(resultado.actualizados).toBe(1);
  expect(await db.productos.get(yerba.id)).toMatchObject({ costoActual: 110_000, precioVentaActual: 174_000, actualizado: AHORA.toISOString() });
  expect(await db.productos.get(aceite.id)).toMatchObject({ costoActual: 100_000, precioVentaActual: 160_000 });
  expect(await db.historialPrecios.toArray()).toEqual([
    expect.objectContaining({ productoId: yerba.id, proveedorId, costo: 110_000, precioVenta: 174_000, fecha: AHORA.toISOString() }),
  ]);
  expect(await db.importaciones.get(resultado.importacionId)).toMatchObject({ archivoNombre: 'el-sol.xlsx', totalLineas: 2, estado: 'aprobada' });
  const lineas = await db.lineasImportacion.where('importacionId').equals(resultado.importacionId).sortBy('filaOrigen');
  expect(lineas.map((l) => [l.productoId, l.estado, l.precioFinal, l.variacionPct])).toEqual([
    [yerba.id, 'aprobada', 174_000, 1000],
    [aceite.id, 'ignorada', null, -1000],
  ]);
});

it('productosUltimaRevision: los aprobados de la última lista revisada', async () => {
  const { productosUltimaRevision } = await import('./revision');
  expect(await productosUltimaRevision(db)).toEqual([]);
  const base = { proveedorId: 1, archivoNombre: 'x', totalLineas: 2, vinculadas: 2, estado: 'aprobada' as const };
  const vieja = await db.importaciones.add({ ...base, fecha: '2026-10-01T00:00:00.000Z' });
  const nueva = await db.importaciones.add({ ...base, fecha: '2026-10-10T00:00:00.000Z' });
  const linea = { filaOrigen: 1, codigo: null, descripcion: 'x', costo: 1, costoAnterior: 1, precioSugerido: 1, precioFinal: 1, variacionPct: 0 };
  await db.lineasImportacion.bulkAdd([
    { ...linea, importacionId: vieja, productoId: 1, estado: 'aprobada' },
    { ...linea, importacionId: nueva, productoId: 2, estado: 'aprobada' },
    { ...linea, importacionId: nueva, productoId: 3, estado: 'ignorada' },
  ]);
  expect(await productosUltimaRevision(db)).toEqual([2]);
});
