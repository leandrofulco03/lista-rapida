import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { IndiceCatalogo, vincularLinea } from '../domain/vinculacion';
import { guardarVinculos, importarCatalogo, listarProductos, vinculosDeProveedor } from './catalogo';
import { BaseListaRapida } from './esquema';
import { borrarProveedor, crearProveedor } from './proveedores';

let db: BaseListaRapida;
let n = 0;

beforeEach(async () => {
  db = new BaseListaRapida(`prueba-vinculos-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const casos = JSON.parse(readFileSync(join(__dirname, '../../tests/fixtures/vinculacion/casos.json'), 'utf-8')) as {
  catalogo: string[];
  lineas: { descripcion: string; esperado: number | null }[];
};

async function cargarCatalogo() {
  await importarCatalogo(
    db,
    casos.catalogo.map((descripcion, i) => ({ codigo: `P${i}`, descripcion, rubro: null, costo: 100_00, precioVenta: 150_00, ivaPct: null, filaOrigen: i + 2 })),
    { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' },
  );
  const productos = await listarProductos(db);
  const porCodigo = new Map(productos.map((p) => [p.codigoInterno, p.id]));
  return { productos, idDe: (posicion: number) => porCodigo.get(`P${posicion}`)! };
}

describe('vínculos guardados', () => {
  it('guarda por código o por descripción, y los cambia sin duplicar', async () => {
    const { id } = await crearProveedor(db, 'El Sol', false);
    await guardarVinculos(db, id, [
      { codigo: 'AB-1', descripcion: 'Yerba', productoId: 1 },
      { codigo: null, descripcion: 'Aceite 1 LT', productoId: 2 },
    ]);
    await guardarVinculos(db, id, [
      { codigo: 'ab-1', descripcion: 'Yerba nueva', productoId: 3 },
      { codigo: 'C', descripcion: 'x', productoId: 4 },
      { codigo: 'C', descripcion: 'x', productoId: 5 },
    ]);
    expect(await vinculosDeProveedor(db, id)).toEqual(
      new Map([
        ['ab-1', 3],
        ['c', 5],
        ['desc:aceite 1000ml', 2],
      ]),
    );
    expect(await db.vinculos.count()).toBe(3);
  });

  it('cada proveedor tiene los suyos, y se borran con el proveedor', async () => {
    const sol = await crearProveedor(db, 'El Sol', false);
    const luna = await crearProveedor(db, 'La Luna', false);
    await guardarVinculos(db, sol.id, [{ codigo: 'A', descripcion: 'a', productoId: 1 }]);
    await guardarVinculos(db, luna.id, [{ codigo: 'A', descripcion: 'a', productoId: 2 }]);
    expect(await vinculosDeProveedor(db, luna.id)).toEqual(new Map([['a', 2]]));
    await borrarProveedor(db, sol.id);
    expect(await vinculosDeProveedor(db, sol.id)).toEqual(new Map());
    expect(await db.vinculos.count()).toBe(1);
  });
});

describe('F07: desde la segunda lista, el 85% se vincula solo', () => {
  /** Primera lista: el comerciante confirma cada línea con su producto (las que no tiene, las deja). */
  async function primeraLista(proveedorId: number, idDe: (posicion: number) => number, conCodigo: boolean) {
    await guardarVinculos(
      db,
      proveedorId,
      casos.lineas.flatMap((l, i) =>
        l.esperado === null ? [] : [{ codigo: conCodigo ? `C${i}` : null, descripcion: l.descripcion, productoId: idDe(l.esperado) }],
      ),
    );
  }

  /** Segunda lista: la misma, sin 3 productos, con 4 que antes no traía y otros precios. */
  const segunda = (conCodigo: boolean) => [
    ...casos.lineas.slice(3).map((l, i) => ({ codigo: conCodigo ? `C${i + 3}` : null, descripcion: l.descripcion })),
    { codigo: conCodigo ? 'N1' : null, descripcion: 'Fernet Branca 750 cc' },
    { codigo: conCodigo ? 'N2' : null, descripcion: 'Yerba Playadito Suave 1 kg' },
    { codigo: conCodigo ? 'N3' : null, descripcion: 'Arroz Gallo Oro 500 g' },
    { codigo: conCodigo ? 'N4' : null, descripcion: 'Pan rallado Preferido 500 g' },
  ];

  it.each([
    ['con códigos', true],
    ['sin códigos (por descripción)', false],
  ])('%s', async (_, conCodigo) => {
    const { productos, idDe } = await cargarCatalogo();
    const { id } = await crearProveedor(db, 'El Sol', false);
    await primeraLista(id, idDe, conCodigo);

    const vinculados = await vinculosDeProveedor(db, id);
    const indice = new IndiceCatalogo(productos);
    const lineas = segunda(conCodigo);
    const resultados = lineas.map((l) => vincularLinea(l, vinculados, indice));
    const solas = resultados.filter((r) => r.estado === 'vinculada').length;
    // Las que el comercio tiene en el catálogo: todas menos las 9 que no tiene y las 4 nuevas.
    const existen = lineas.length - 9 - 4;
    expect(solas / existen).toBeGreaterThanOrEqual(0.85);
  });
});
