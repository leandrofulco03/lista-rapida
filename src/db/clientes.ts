import type { Centavos } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { MedioPago } from '../domain/ventas';
import type { Sesion } from './tipos';

/** Fase 10: clientes con fiado. Cualquier miembro elige un cliente al vender; el resto es del dueño. */

/** Para elegir al vender: sin saldo, sólo cuánto más se le puede fiar (null = sin límite). */
export interface ClienteVenta {
  id: Id;
  nombre: string;
  disponible: Centavos | null;
}

const numero = (n: unknown): number | null => (n === null || n === undefined ? null : Number(n));

export async function clientesParaVender(s: Sesion): Promise<ClienteVenta[]> {
  const clientes = await s.backend.rpc<ClienteVenta[]>('clientes_para_vender', { c: s.comercioId });
  return clientes.map((k) => ({ ...k, disponible: numero(k.disponible) }));
}

export interface Cliente {
  id: Id;
  nombre: string;
  telefono: string | null;
  limite: Centavos | null;
  nota: string | null;
  archivado: boolean;
  /** Lo que debe; negativo, tiene a favor. */
  saldo: Centavos;
  ultimoMovimiento: string | null;
}

export async function listarClientes(s: Sesion): Promise<Cliente[]> {
  const clientes = await s.backend.rpc<Cliente[]>('listar_clientes', { c: s.comercioId });
  return clientes.map((k) => ({ ...k, saldo: Number(k.saldo), limite: numero(k.limite) }));
}

export interface DatosCliente {
  id: Id;
  nombre: string;
  telefono: string | null;
  limite: Centavos | null;
  nota: string | null;
}

export async function guardarCliente(s: Sesion, cliente: DatosCliente): Promise<void> {
  await s.backend.rpc('guardar_cliente', { c: s.comercioId, cliente });
}

/** Archivar lo saca de la lista para vender (con deuda no se puede). */
export async function archivarCliente(s: Sesion, id: Id, archivado: boolean): Promise<void> {
  await s.backend.rpc('archivar_cliente', { c: s.comercioId, id, archivado });
}

export interface MovimientoCliente {
  tipo: 'venta' | 'pago';
  id: Id;
  fecha: string;
  monto: Centavos;
  /** Sólo en los pagos. */
  medioPago: MedioPago | null;
  anulado: boolean;
  /** Productos de la venta, o la nota del pago. */
  detalle: string | null;
}

export async function movimientosCliente(s: Sesion, clienteId: Id): Promise<MovimientoCliente[]> {
  const movimientos = await s.backend.rpc<MovimientoCliente[]>('movimientos_cliente', { c: s.comercioId, cliente: clienteId });
  return movimientos.map((m) => ({ ...m, monto: Number(m.monto) }));
}

/** Registra lo que pagó el cliente. Devuelve el saldo que le queda. */
export async function registrarPago(s: Sesion, pago: { clienteId: Id; monto: Centavos; medioPago: MedioPago; nota?: string }): Promise<Centavos> {
  return Number(await s.backend.rpc('registrar_pago', { c: s.comercioId, pago }));
}

export async function anularPago(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('anular_pago', { c: s.comercioId, id });
}
