import type { MapeoColumnas } from '../domain/columnas';
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
