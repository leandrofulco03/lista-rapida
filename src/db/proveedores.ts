import type { MapeoColumnas } from '../domain/columnas';
import { CIEN_POR_CIENTO } from '../domain/dinero';
import type { Porcentaje } from '../domain/dinero';
import type { BaseListaRapida, Proveedor } from './esquema';

export const LARGO_MAXIMO_NOMBRE_PROVEEDOR = 60;

/** F02 (mínimo para la Fase 2): proveedores ordenados por nombre. */
export async function listarProveedores(db: BaseListaRapida): Promise<Proveedor[]> {
  return db.proveedores.orderBy('nombre').toArray();
}

/**
 * Crea un proveedor sólo con el nombre; si ya existe uno con el mismo nombre (sin importar
 * mayúsculas ni espacios), devuelve ese. La ficha completa del proveedor llega con F02.
 */
export async function crearProveedor(
  db: BaseListaRapida,
  nombre: string,
  listaIncluyeIva: boolean,
  ahora = new Date(),
): Promise<Proveedor> {
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  if (limpio === '') throw new Error('Escribí el nombre del proveedor.');
  if (limpio.length > LARGO_MAXIMO_NOMBRE_PROVEEDOR) {
    throw new Error(`El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE_PROVEEDOR} letras.`);
  }
  const existente = (await db.proveedores.toArray()).find((p) => p.nombre.toLowerCase() === limpio.toLowerCase());
  if (existente) return existente;
  const nuevo: Omit<Proveedor, 'id'> = {
    nombre: limpio,
    mapeoColumnas: null,
    listaIncluyeIva,
    descuentosPct: [],
    creado: ahora.toISOString(),
  };
  const id = await db.proveedores.add(nuevo);
  return { ...nuevo, id };
}

/** F06: recuerda las columnas de la lista del proveedor (y si sus precios traen IVA) para el próximo envío. */
export async function guardarLecturaProveedor(
  db: BaseListaRapida,
  id: number,
  mapeoColumnas: MapeoColumnas,
  listaIncluyeIva: boolean,
): Promise<void> {
  const cambiados = await db.proveedores.update(id, { mapeoColumnas, listaIncluyeIva });
  if (cambiados === 0 && !(await db.proveedores.get(id))) throw new Error('No encontramos el proveedor.');
}

/** F02: datos del proveedor que se editan en su ficha. */
export interface DatosProveedor {
  nombre: string;
  listaIncluyeIva: boolean;
  descuentosPct: Porcentaje[];
}

/** F02: edita la ficha del proveedor. El nombre no se puede repetir con otro proveedor. */
export async function actualizarProveedor(db: BaseListaRapida, id: number, datos: DatosProveedor): Promise<Proveedor> {
  const nombre = datos.nombre.replace(/\s+/g, ' ').trim();
  if (nombre === '') throw new Error('Escribí el nombre del proveedor.');
  if (nombre.length > LARGO_MAXIMO_NOMBRE_PROVEEDOR) {
    throw new Error(`El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE_PROVEEDOR} letras.`);
  }
  if (datos.descuentosPct.some((d) => !Number.isSafeInteger(d) || d <= 0 || d >= CIEN_POR_CIENTO)) {
    throw new Error('Cada descuento tiene que estar entre 0% y 100%.');
  }
  return db.transaction('rw', db.proveedores, async () => {
    const actual = await db.proveedores.get(id);
    if (!actual) throw new Error('No encontramos el proveedor.');
    const repetido = (await db.proveedores.toArray()).find((p) => p.id !== id && p.nombre.toLowerCase() === nombre.toLowerCase());
    if (repetido) throw new Error(`Ya existe el proveedor ${repetido.nombre}.`);
    const cambios = { nombre, listaIncluyeIva: datos.listaIncluyeIva, descuentosPct: [...datos.descuentosPct] };
    await db.proveedores.update(id, cambios);
    return { ...actual, ...cambios };
  });
}

/** F02: olvida las columnas recordadas; la próxima lista del proveedor vuelve a preguntar. */
export async function olvidarColumnas(db: BaseListaRapida, id: number): Promise<void> {
  await db.proveedores.update(id, { mapeoColumnas: null });
}

/** F02: baja del proveedor, con sus vínculos y sus importaciones. Los productos del catálogo quedan. */
export async function borrarProveedor(db: BaseListaRapida, id: number): Promise<void> {
  await db.transaction('rw', [db.proveedores, db.vinculos, db.importaciones, db.lineasImportacion], async () => {
    const importaciones = await db.importaciones.where('proveedorId').equals(id).primaryKeys();
    await db.lineasImportacion.where('importacionId').anyOf(importaciones).delete();
    await db.importaciones.bulkDelete(importaciones);
    await db.vinculos.filter((v) => v.proveedorId === id).delete();
    await db.proveedores.delete(id);
  });
}
