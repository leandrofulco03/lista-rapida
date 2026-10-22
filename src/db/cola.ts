import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Id } from '../domain/id';
import { registrarVenta } from './ventas';
import type { ProductoVenta, VentaNueva } from './ventas';
import type { ClienteVenta } from './clientes';
import type { Sesion } from './tipos';

/**
 * Ventas sin conexión. Cada venta se guarda primero en el dispositivo y después se manda a la base;
 * si no hay internet, queda en la cola y se manda cuando vuelve. La base no la duplica si llega dos veces.
 * También se guarda acá la lista de productos para vender, para buscar y escanear sin conexión.
 */

export interface VentaPendiente {
  id: Id;
  comercioId: Id;
  venta: VentaNueva;
  /** Último error que no es de conexión (la base rechazó la venta); null si sólo falta conexión. */
  error: string | null;
  intentos: number;
}

export interface ProductosGuardados {
  comercioId: Id;
  productos: ProductoVenta[];
  masVendidos: Id[];
  /** Clientes para fiar sin conexión (Fase 10; las copias viejas no lo tienen). */
  clientes?: ClienteVenta[];
  fecha: string;
}

export class BaseDispositivo extends Dexie {
  pendientes!: EntityTable<VentaPendiente, 'id'>;
  productos!: EntityTable<ProductosGuardados, 'comercioId'>;

  constructor(nombre = 'listamatch-dispositivo') {
    super(nombre);
    this.version(1).stores({ pendientes: 'id, comercioId', productos: 'comercioId' });
  }
}

let base: BaseDispositivo | undefined;
/** Base única del dispositivo (se abre la primera vez que se usa). */
export const baseDispositivo = (): BaseDispositivo => (base ??= new BaseDispositivo());

/** Si el error es por falta de conexión (se reintenta) o porque la base rechazó la venta. */
export function esErrorDeConexion(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /conexi[oó]n|failed to fetch|network|load failed|timeout|offline|fetch/i.test(mensaje);
}

export async function encolarVenta(b: BaseDispositivo, comercioId: Id, venta: VentaNueva): Promise<void> {
  await b.pendientes.put({ id: venta.id, comercioId, venta, error: null, intentos: 0 });
}

export async function ventasPendientes(b: BaseDispositivo, comercioId: Id): Promise<VentaPendiente[]> {
  const pendientes = await b.pendientes.where('comercioId').equals(comercioId).toArray();
  return pendientes.sort((x, y) => x.venta.fecha.localeCompare(y.venta.fecha));
}

export interface ResultadoSincronizar {
  enviadas: number;
  pendientes: number;
  conError: number;
  sinConexion: boolean;
}

/** Manda las ventas pendientes del comercio, de la más vieja a la más nueva. Sin conexión, para y deja el resto. */
export async function sincronizar(b: BaseDispositivo, s: Sesion): Promise<ResultadoSincronizar> {
  let enviadas = 0;
  let sinConexion = false;
  for (const p of await ventasPendientes(b, s.comercioId)) {
    try {
      await registrarVenta(s, p.venta);
      await b.pendientes.delete(p.id);
      enviadas++;
    } catch (error) {
      if (esErrorDeConexion(error)) {
        sinConexion = true;
        break;
      }
      await b.pendientes.update(p.id, { error: (error as Error).message, intentos: p.intentos + 1 });
    }
  }
  const quedan = await ventasPendientes(b, s.comercioId);
  return { enviadas, pendientes: quedan.length, conError: quedan.filter((p) => p.error).length, sinConexion };
}

/** Descarta una venta pendiente que la base rechazó (por ejemplo, de un comercio del que ya no se es parte). */
export async function descartarPendiente(b: BaseDispositivo, id: Id): Promise<void> {
  await b.pendientes.delete(id);
}

export async function guardarProductosDispositivo(b: BaseDispositivo, datos: ProductosGuardados): Promise<void> {
  await b.productos.put(datos);
}

export async function productosDelDispositivo(b: BaseDispositivo, comercioId: Id): Promise<ProductosGuardados | undefined> {
  return b.productos.get(comercioId);
}
