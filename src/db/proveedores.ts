import type { MapeoColumnas } from '../domain/columnas';
import { CIEN_POR_CIENTO } from '../domain/dinero';
import type { Porcentaje } from '../domain/dinero';
import type { Id } from '../domain/id';
import { deFila, deFilas } from './filas';
import type { Proveedor, Sesion } from './tipos';

export const LARGO_MAXIMO_NOMBRE_PROVEEDOR = 60;

/** F02: proveedores ordenados por nombre. */
export async function listarProveedores(s: Sesion): Promise<Proveedor[]> {
  return deFilas<Proveedor>(await s.backend.rpc('listar_proveedores', { c: s.comercioId }));
}

function nombreValido(nombre: string): string {
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  if (limpio === '') throw new Error('Escribí el nombre del proveedor.');
  if (limpio.length > LARGO_MAXIMO_NOMBRE_PROVEEDOR) {
    throw new Error(`El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE_PROVEEDOR} letras.`);
  }
  return limpio;
}

/**
 * Crea un proveedor sólo con el nombre; si ya existe uno con el mismo nombre (sin importar
 * mayúsculas ni espacios), devuelve ese.
 */
export async function crearProveedor(s: Sesion, nombre: string, listaIncluyeIva: boolean): Promise<Proveedor> {
  const fila = await s.backend.rpc<Record<string, unknown>>('crear_proveedor', {
    c: s.comercioId,
    nombre: nombreValido(nombre),
    lista_incluye_iva: listaIncluyeIva,
  });
  return deFila<Proveedor>(fila);
}

/** F06: recuerda las columnas de la lista del proveedor (y si sus precios traen IVA) para el próximo envío. */
export async function guardarLecturaProveedor(s: Sesion, id: Id, mapeoColumnas: MapeoColumnas, listaIncluyeIva: boolean): Promise<void> {
  await s.backend.rpc('guardar_lectura_proveedor', { c: s.comercioId, id, mapeo_columnas: mapeoColumnas, lista_incluye_iva: listaIncluyeIva });
}

/** F02: datos del proveedor que se editan en su ficha. */
export interface DatosProveedor {
  nombre: string;
  listaIncluyeIva: boolean;
  descuentosPct: Porcentaje[];
}

/** F02: edita la ficha del proveedor. El nombre no se puede repetir con otro proveedor. */
export async function actualizarProveedor(s: Sesion, id: Id, datos: DatosProveedor): Promise<Proveedor> {
  const nombre = nombreValido(datos.nombre);
  if (datos.descuentosPct.some((d) => !Number.isSafeInteger(d) || d <= 0 || d >= CIEN_POR_CIENTO)) {
    throw new Error('Cada descuento tiene que estar entre 0% y 100%.');
  }
  const fila = await s.backend.rpc<Record<string, unknown>>('actualizar_proveedor', {
    c: s.comercioId,
    id,
    nombre,
    lista_incluye_iva: datos.listaIncluyeIva,
    descuentos_pct: [...datos.descuentosPct],
  });
  return deFila<Proveedor>(fila);
}

/** F02: olvida las columnas recordadas; la próxima lista del proveedor vuelve a preguntar. */
export async function olvidarColumnas(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('guardar_lectura_proveedor', { c: s.comercioId, id, mapeo_columnas: null });
}

/** F02: baja del proveedor, con sus vínculos y sus importaciones. Los productos del catálogo quedan. */
export async function borrarProveedor(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('borrar_proveedor', { c: s.comercioId, id });
}
