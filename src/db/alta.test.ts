import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import type { LineaLista } from '../domain/lineaLista';
import { armarRevision } from '../domain/revision';
import { IndiceCatalogo, vincularLinea } from '../domain/vinculacion';
import { borrarProducto, darDeAltaDesdeLista, guardarProducto, listarProductos, vinculosDeProveedor } from './catalogo';
import { BaseListaRapida } from './esquema';
import { crearProveedor } from './proveedores';
import { aplicarRevision } from './revision';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-alta-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const config = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' }; // recargo 30%, redondeo a $10, venta con IVA
const AHORA = new Date('2026-10-13T12:00:00Z');
const linea = (fila: number, codigo: string | null, descripcion: string, costo = 100_000): LineaLista => ({
  codigo,
  descripcion,
  presentacion: null,
  costo,
  ivaIncluido: null,
  filaOrigen: fila,
});

describe('darDeAltaDesdeLista (F07/F03)', () => {
  it('crea los productos sin costo ni precio y los deja vinculados a la línea del proveedor', async () => {
    await guardarProducto(db, { codigoInterno: 'E2', descripcion: 'Otro', rubroId: null, recargoPct: null, ivaPct: 2100, costoActual: 1, precioVentaActual: 1 });
    const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
    const lineas = [linea(2, 'E1', 'Fernet Branca 750 cc'), linea(3, 'E2', 'Gancia 950 cc'), linea(4, null, 'Pan rallado Preferido 500 g')];

    const creados = await darDeAltaDesdeLista(db, proveedorId, lineas, 1050, AHORA);

    expect(creados.map((p) => [p.codigoInterno, p.descripcion, p.costoActual, p.precioVentaActual, p.ivaPct, p.rubroId])).toEqual([
      ['E1', 'Fernet Branca 750 cc', 0, 0, 1050, null],
      ['P0001', 'Gancia 950 cc', 0, 0, 1050, null], // "E2" ya era de otro producto
      ['P0002', 'Pan rallado Preferido 500 g', 0, 0, 1050, null],
    ]);
    expect(await db.productos.count()).toBe(4);
    expect(await db.historialPrecios.count()).toBe(0);
    // La próxima lista los reconoce solos.
    const vinculados = await vinculosDeProveedor(db, proveedorId);
    const indice = new IndiceCatalogo(await listarProductos(db));
    expect(lineas.map((l) => vincularLinea(l, vinculados, indice))).toEqual(
      creados.map((p) => ({ estado: 'vinculada', productoId: p.id, opciones: [] })),
    );
  });

  it('una línea repetida crea un solo producto', async () => {
    const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
    const creados = await darDeAltaDesdeLista(db, proveedorId, [linea(2, null, 'Yerba 1 kg'), linea(3, null, 'YERBA 1000 GRS')], 2100);
    expect(creados[0]!.id).toBe(creados[1]!.id);
    expect(await db.productos.count()).toBe(1);
    expect(await db.vinculos.count()).toBe(1);
  });

  it('deshacer el alta borra el producto y su vínculo', async () => {
    const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
    const [creado] = await darDeAltaDesdeLista(db, proveedorId, [linea(2, 'E1', 'Fernet')], 2100);
    await borrarProducto(db, creado!.id);
    expect(await db.productos.count()).toBe(0);
    expect(await vinculosDeProveedor(db, proveedorId)).toEqual(new Map());
  });

  it('en la revisión aparece como "sin costo anterior" (de a uno) y el precio se guarda sólo al aprobarlo', async () => {
    const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
    const lineas = [linea(2, 'E1', 'Fernet Branca 750 cc', 500_000)];
    const [creado] = await darDeAltaDesdeLista(db, proveedorId, lineas, 2100);
    const productos = await listarProductos(db);
    const { cambios } = armarRevision({
      lineas: [{ linea: lineas[0]!, productoId: creado!.id }],
      productos: new Map(productos.map((p) => [p.id, p])),
      recargosRubro: new Map(),
      vinculadosAntes: new Set(),
      listaIncluyeIva: false,
      descuentos: [],
      config,
    });
    // 5000 · 1,21 · 1,30 = 7865 → $7870.
    expect(cambios[0]).toMatchObject({ individual: true, motivo: 'sin-costo-anterior', precioSugerido: 787_000, precioAnterior: 0 });
    await aplicarRevision(db, { proveedorId, archivo: 'el-sol.csv', totalLineas: 1, cambios, decisiones: new Map([[creado!.id, { precio: 799_000 }]]) }, AHORA);
    expect(await db.productos.get(creado!.id)).toMatchObject({ costoActual: 500_000, precioVentaActual: 799_000 });
  });
});

describe('aplicarRevision con precio a mano (F09)', () => {
  async function preparar() {
    const { id: proveedorId } = await crearProveedor(db, 'El Sol', false);
    const yerba = await guardarProducto(db, { codigoInterno: 'Y', descripcion: 'Yerba', rubroId: null, recargoPct: null, ivaPct: 2100, costoActual: 100_000, precioVentaActual: 160_000 });
    const { cambios } = armarRevision({
      lineas: [{ linea: linea(1, 'Y', 'Yerba', 110_000), productoId: yerba.id }],
      productos: new Map([[yerba.id, yerba]]),
      recargosRubro: new Map(),
      vinculadosAntes: new Set(),
      listaIncluyeIva: false,
      descuentos: [],
      config,
    });
    return { proveedorId, yerba, cambios };
  }

  it('el historial y la línea de la importación registran el precio elegido, aunque quede bajo el costo', async () => {
    const { proveedorId, yerba, cambios } = await preparar();
    expect(cambios[0]!.precioSugerido).toBe(174_000);
    const { importacionId } = await aplicarRevision(
      db,
      { proveedorId, archivo: 'x.csv', totalLineas: 1, cambios, decisiones: new Map([[yerba.id, { precio: 129_999 }]]) },
      AHORA,
    );
    expect(await db.productos.get(yerba.id)).toMatchObject({ costoActual: 110_000, precioVentaActual: 129_999 });
    expect(await db.historialPrecios.toArray()).toEqual([expect.objectContaining({ productoId: yerba.id, costo: 110_000, precioVenta: 129_999 })]);
    const [l] = await db.lineasImportacion.where('importacionId').equals(importacionId).toArray();
    expect(l).toMatchObject({ precioSugerido: 174_000, precioFinal: 129_999, estado: 'aprobada' });
  });

  it('un precio en cero o con fracción de centavo no se guarda: no cambia nada', async () => {
    const { proveedorId, yerba, cambios } = await preparar();
    for (const precio of [0, -10, 100.5]) {
      await expect(
        aplicarRevision(db, { proveedorId, archivo: 'x.csv', totalLineas: 1, cambios, decisiones: new Map([[yerba.id, { precio }]]) }),
      ).rejects.toThrow('no es válido');
    }
    expect(await db.productos.get(yerba.id)).toMatchObject({ costoActual: 100_000, precioVentaActual: 160_000 });
    expect(await db.historialPrecios.count()).toBe(0);
    expect(await db.importaciones.count()).toBe(0);
  });
});
