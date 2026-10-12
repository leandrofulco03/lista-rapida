import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { leerRespaldo } from '../domain/respaldo';
import { guardarProducto, guardarRubro, guardarVinculos } from './catalogo';
import { guardarConfig, leerConfig } from './config';
import { BaseListaRapida, TABLAS } from './esquema';
import { crearProveedor } from './proveedores';
import { exportarRespaldo, hayDatos, restaurarRespaldo } from './respaldo';

const bases: BaseListaRapida[] = [];
let n = 0;
function nueva() {
  const db = new BaseListaRapida(`prueba-respaldo-${n++}`);
  bases.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(bases.splice(0).map((db) => db.delete()));
});

const AHORA = new Date('2026-10-12T12:00:00Z');

it('una copia restaura todo en otro dispositivo, tabla por tabla', async () => {
  const origen = nueva();
  await guardarConfig(origen, { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén Don José' });
  const rubro = await guardarRubro(origen, { nombre: 'Almacén', recargoPct: 3500 });
  const yerba = await guardarProducto(origen, {
    codigoInterno: 'P1',
    descripcion: 'Yerba 1 kg',
    rubroId: rubro.id,
    recargoPct: null,
    ivaPct: 2100,
    costoActual: 100_000,
    precioVentaActual: 160_000,
  });
  const proveedor = await crearProveedor(origen, 'El Sol', true);
  await guardarVinculos(origen, proveedor.id, [{ codigo: 'A1', descripcion: 'Yerba', productoId: yerba.id }]);
  await origen.historialPrecios.add({ productoId: yerba.id, proveedorId: proveedor.id, fecha: AHORA.toISOString(), costo: 100_000, precioVenta: 160_000 });
  expect(await hayDatos(origen)).toBe(true);

  const respaldo = await exportarRespaldo(origen, AHORA);
  expect((await leerConfig(origen))?.ultimoRespaldo).toBe(AHORA.toISOString());

  // Pasa por el archivo, como en la realidad.
  const lectura = leerRespaldo(JSON.stringify(respaldo), 2);
  if (!lectura.ok) throw new Error(lectura.error);

  const destino = nueva();
  await guardarConfig(destino, { ...CONFIG_SUGERIDA, nombreComercio: 'Otro' });
  await destino.productos.add({ ...yerba, id: 99, codigoInterno: 'X' });
  await restaurarRespaldo(destino, lectura.respaldo);

  for (const tabla of TABLAS) {
    expect(await destino.table(tabla).toArray(), tabla).toEqual(await origen.table(tabla).toArray());
  }
  expect((await leerConfig(destino))?.nombreComercio).toBe('Almacén Don José');
  // Los ids siguen andando: lo próximo que se agrega no pisa nada.
  const otro = await guardarRubro(destino, { nombre: 'Limpieza', recargoPct: null });
  expect(otro.id).toBeGreaterThan(rubro.id);
});

it('una copia de la versión 1 del esquema se migra al restaurar', async () => {
  const destino = nueva();
  const vacia = Object.fromEntries(TABLAS.map((t) => [t, [] as Record<string, unknown>[]])) as Record<(typeof TABLAS)[number], Record<string, unknown>[]>;
  await restaurarRespaldo(destino, {
    app: 'lista-rapida',
    formato: 1,
    version: 1,
    fecha: AHORA.toISOString(),
    tablas: {
      ...vacia,
      config: [{ ...CONFIG_SUGERIDA, nombreComercio: 'Viejo', id: 'comercio' }],
      productos: [{ id: 1, codigoInterno: 'P1', descripcion: 'Aceite 1,5 Lt', descripcionNormalizada: 'aceite 1 5 lt', rubroId: null, recargoPct: null, ivaPct: 2100, costoActual: 1, precioVentaActual: 1, actualizado: AHORA.toISOString() }],
    },
  });
  expect((await destino.productos.get(1))?.descripcionNormalizada).toBe('aceite 1500ml');
});

it('sin productos ni proveedores no hay nada que respaldar', async () => {
  expect(await hayDatos(nueva())).toBe(false);
});
