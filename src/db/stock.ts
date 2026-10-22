import type { Id } from '../domain/id';
import type { Sesion } from './tipos';

/** Fase 10: stock opcional por producto (sólo el dueño). Se descuenta solo al vender y vuelve al anular. */

export interface ProductoConStock {
  productoId: Id;
  codigoInterno: string;
  descripcion: string;
  /** Puede ser negativo: se vendió más de lo que se había contado. */
  cantidad: number;
  actualizado: string;
  /** Unidades vendidas en los últimos 28 días. */
  vendido28: number;
  /** Un proveedor que lo trae (por las listas vinculadas), o null. */
  proveedor: string | null;
}

export async function listarStock(s: Sesion): Promise<ProductoConStock[]> {
  const filas = await s.backend.rpc<ProductoConStock[]>('listar_stock', { c: s.comercioId });
  // numeric llega como texto desde Supabase.
  return filas.map((f) => ({ ...f, cantidad: Number(f.cantidad), vendido28: Number(f.vendido28) }));
}

export interface ItemStock {
  productoId: Id;
  cantidad: number;
}

/** Llegó mercadería: suma. Un producto que no llevaba stock empieza a llevarlo con esa cantidad. */
export async function ingresoStock(s: Sesion, items: ItemStock[], nota = ''): Promise<void> {
  await s.backend.rpc('ingreso_stock', { c: s.comercioId, items, nota });
}

/** Se contó: deja cada producto con la cantidad contada (y empieza a llevar stock si no lo llevaba). */
export async function ajustarStock(s: Sesion, items: ItemStock[], nota = ''): Promise<void> {
  await s.backend.rpc('ajustar_stock', { c: s.comercioId, items, nota });
}

export async function dejarStock(s: Sesion, productoId: Id): Promise<void> {
  await s.backend.rpc('dejar_stock', { c: s.comercioId, producto: productoId });
}

export interface MovimientoStock {
  fecha: string;
  tipo: 'inicio' | 'venta' | 'anulacion' | 'ingreso' | 'ajuste';
  cantidad: number;
  nota: string | null;
}

export async function movimientosDeStock(s: Sesion, productoId: Id): Promise<MovimientoStock[]> {
  const filas = await s.backend.rpc<MovimientoStock[]>('movimientos_de_stock', { c: s.comercioId, producto: productoId });
  return filas.map((m) => ({ ...m, cantidad: Number(m.cantidad) }));
}
