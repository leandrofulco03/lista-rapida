import type { Centavos } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { DatosResumen, Dia, LineaTicket, MedioPago, MedioVenta } from '../domain/ventas';
import type { Sesion } from './tipos';

/** Fase 8: ventas en la base. Cualquier miembro vende; el resumen y el total del día son del dueño. */

/** Lo que hace falta de un producto para venderlo (sin costo: el empleado no lo ve). */
export interface ProductoVenta {
  id: Id;
  codigoInterno: string;
  codigoBarras: string | null;
  descripcion: string;
  descripcionNormalizada: string;
  precioVentaActual: Centavos;
}

export async function productosParaVender(s: Sesion): Promise<ProductoVenta[]> {
  return s.backend.rpc<ProductoVenta[]>('productos_para_vender', { c: s.comercioId });
}

/** Ids de los más vendidos de los últimos 30 días. */
export async function masVendidos(s: Sesion, cantidad = 8): Promise<Id[]> {
  return s.backend.rpc<Id[]>('mas_vendidos', { c: s.comercioId, cantidad });
}

/** Un ticket listo para guardar. El id y la fecha los pone el dispositivo (sirve sin conexión). */
export interface VentaNueva {
  id: Id;
  fecha: string;
  medioPago: MedioVenta;
  lineas: LineaTicket[];
  /** Sólo con fiado. Si el id no existe en la base, se crea el cliente con ese nombre (alta sin conexión). */
  cliente?: { id: Id; nombre: string };
}

export interface VentaGuardada {
  id: Id;
  total: Centavos;
  dia: Dia;
}

/** Guarda el ticket. Si ya se había guardado (se reintentó), no lo duplica. */
export async function registrarVenta(s: Sesion, venta: VentaNueva): Promise<VentaGuardada> {
  return s.backend.rpc<VentaGuardada>('registrar_venta', { c: s.comercioId, venta });
}

export async function anularVenta(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('anular_venta', { c: s.comercioId, id });
}

export interface TicketDelDia {
  id: Id;
  fecha: string;
  medioPago: MedioVenta;
  total: Centavos;
  articulos: number;
  anulada: boolean;
  vendedor: string;
  propia: boolean;
  /** Nombre del cliente si fue fiado. */
  cliente: string | null;
  lineas: { descripcion: string; cantidad: number; precioUnitario: Centavos; subtotal: Centavos }[];
}

/** Tickets de un día: el empleado ve los suyos; el dueño, todos. */
export async function ventasDelDia(s: Sesion, dia: Dia): Promise<TicketDelDia[]> {
  const tickets = await s.backend.rpc<TicketDelDia[]>('ventas_del_dia', { c: s.comercioId, dia });
  // numeric llega como texto desde Supabase.
  return tickets.map((t) => ({ ...t, articulos: Number(t.articulos), lineas: t.lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad) })) }));
}

export type MontosPorMedio = Partial<Record<MedioPago, Centavos>>;

export async function leerSinDetalle(s: Sesion, dia: Dia): Promise<MontosPorMedio> {
  return s.backend.rpc<MontosPorMedio>('leer_sin_detalle', { c: s.comercioId, dia });
}

/** Reemplaza lo vendido sin detalle en un día (un monto en cero lo saca). */
export async function guardarSinDetalle(s: Sesion, dia: Dia, montos: MontosPorMedio): Promise<void> {
  await s.backend.rpc('guardar_sin_detalle', { c: s.comercioId, dia, montos });
}

export async function resumenVentas(s: Sesion, desde: Dia, hasta: Dia): Promise<DatosResumen> {
  const d = await s.backend.rpc<DatosResumen>('resumen_ventas', { c: s.comercioId, desde, hasta });
  return {
    ...d,
    totalTickets: Number(d.totalTickets),
    tickets: Number(d.tickets),
    articulos: Number(d.articulos),
    totalSinDetalle: Number(d.totalSinDetalle),
    diasSinDetalle: Number(d.diasSinDetalle),
    porMedio: d.porMedio.map((m) => ({ ...m, total: Number(m.total) })),
    porDia: d.porDia.map((x) => ({ ...x, total: Number(x.total) })),
  };
}
