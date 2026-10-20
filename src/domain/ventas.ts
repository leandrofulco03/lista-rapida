import type { Centavos } from './dinero';
import type { Id } from './id';

/**
 * Fase 8: ventas. El ticket se arma en el dispositivo y se guarda entero (también sin conexión).
 * Las fechas de los resúmenes son días de Argentina (UTC−3, sin horario de verano).
 */

export const MEDIOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'credito', nombre: 'Crédito' },
  { id: 'qr', nombre: 'Mercado Pago / QR' },
  { id: 'transferencia', nombre: 'Transferencia' },
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number]['id'];

export const nombreMedio = (medio: string): string => MEDIOS_PAGO.find((m) => m.id === medio)?.nombre ?? medio;
export const esMedioPago = (valor: unknown): valor is MedioPago => MEDIOS_PAGO.some((m) => m.id === valor);

/** Una línea del ticket. Sin producto es "Varios": un importe a mano. */
export interface LineaTicket {
  productoId: Id | null;
  descripcion: string;
  /** Unidades; puede tener hasta 3 decimales (kilos de fiambre, por ejemplo). */
  cantidad: number;
  precioUnitario: Centavos;
}

export const DESCRIPCION_VARIOS = 'Varios';
export const CANTIDAD_MAXIMA = 9999;

export const subtotal = (l: LineaTicket): Centavos => Math.round(l.precioUnitario * l.cantidad);
export const totalTicket = (lineas: readonly LineaTicket[]): Centavos => lineas.reduce((t, l) => t + subtotal(l), 0);
export const articulos = (lineas: readonly LineaTicket[]): number => redondear3(lineas.reduce((t, l) => t + l.cantidad, 0));

function redondear3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function cantidadValida(cantidad: number): boolean {
  // Hasta 3 decimales (con margen para el redondeo de los decimales en binario).
  return Number.isFinite(cantidad) && cantidad > 0 && cantidad <= CANTIDAD_MAXIMA && Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) < 1e-6;
}

/** Suma un producto al ticket: si ya está, le suma una unidad. */
export function agregarProducto(lineas: readonly LineaTicket[], producto: { id: Id; descripcion: string; precioVentaActual: Centavos }): LineaTicket[] {
  const i = lineas.findIndex((l) => l.productoId === producto.id);
  if (i >= 0) return lineas.map((l, j) => (j === i ? { ...l, cantidad: Math.min(CANTIDAD_MAXIMA, redondear3(l.cantidad + 1)) } : l));
  return [...lineas, { productoId: producto.id, descripcion: producto.descripcion, cantidad: 1, precioUnitario: producto.precioVentaActual }];
}

/** "Varios": un importe sin producto del catálogo. */
export function agregarVarios(lineas: readonly LineaTicket[], monto: Centavos, descripcion = ''): LineaTicket[] {
  if (!Number.isSafeInteger(monto) || monto <= 0) throw new Error('Escribí un importe mayor que cero.');
  return [...lineas, { productoId: null, descripcion: descripcion.trim() || DESCRIPCION_VARIOS, cantidad: 1, precioUnitario: monto }];
}

/** Cambia la cantidad de una línea; con cero o menos, la saca. */
export function cambiarCantidad(lineas: readonly LineaTicket[], indice: number, cantidad: number): LineaTicket[] {
  if (cantidad <= 0) return lineas.filter((_, j) => j !== indice);
  if (!cantidadValida(cantidad)) return [...lineas];
  return lineas.map((l, j) => (j === indice ? { ...l, cantidad: redondear3(cantidad) } : l));
}

/** Lee una cantidad escrita a mano ("2", "0,5", "1.250"). null si no es válida. */
export function leerCantidad(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(limpio)) return null;
  const n = Number(limpio);
  return cantidadValida(n) ? n : null;
}

export const formatearCantidad = (n: number): string => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

/** Problema que impide cobrar el ticket, o null. */
export function problemaTicket(lineas: readonly LineaTicket[], medio: string | null): string | null {
  if (lineas.length === 0) return 'Agregá al menos un producto.';
  if (lineas.some((l) => !cantidadValida(l.cantidad))) return 'Hay una cantidad que no es válida.';
  if (lineas.some((l) => !Number.isSafeInteger(l.precioUnitario) || l.precioUnitario < 0)) return 'Hay un precio que no es válido.';
  if (totalTicket(lineas) <= 0) return 'El total tiene que ser mayor que cero.';
  if (!esMedioPago(medio)) return 'Elegí cómo pagó.';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Días y períodos (Argentina)
// ---------------------------------------------------------------------------------------------

/** Fecha "AAAA-MM-DD" del día en Argentina. */
export type Dia = string;

const ZONA = 'America/Argentina/Buenos_Aires';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

export const diaDe = (fecha: Date): Dia => formatoDia.format(fecha);

/** Suma días a una fecha "AAAA-MM-DD" (sin zona: aritmética de calendario). */
export function sumarDias(dia: Dia, dias: number): Dia {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo. */
const diaSemana = (dia: Dia) => (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7;

export type TipoPeriodo = 'dia' | 'semana' | 'mes';

export interface Periodo {
  tipo: TipoPeriodo;
  /** Primer día, incluido. */
  desde: Dia;
  /** Último día, incluido. */
  hasta: Dia;
}

/** El día, la semana (de lunes a domingo) o el mes que contiene a `dia`. */
export function periodoDe(tipo: TipoPeriodo, dia: Dia): Periodo {
  if (tipo === 'dia') return { tipo, desde: dia, hasta: dia };
  if (tipo === 'semana') {
    const desde = sumarDias(dia, -diaSemana(dia));
    return { tipo, desde, hasta: sumarDias(desde, 6) };
  }
  const desde = `${dia.slice(0, 7)}-01`;
  const siguiente = new Date(`${desde}T12:00:00Z`);
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  return { tipo, desde, hasta: sumarDias(siguiente.toISOString().slice(0, 10), -1) };
}

/** El período anterior del mismo tipo (el día de ayer, la semana pasada, el mes pasado). */
export const periodoAnterior = (p: Periodo): Periodo => periodoDe(p.tipo, sumarDias(p.desde, -1));
export const periodoSiguiente = (p: Periodo): Periodo => periodoDe(p.tipo, sumarDias(p.hasta, 1));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function diaLegible(dia: Dia, conAnio = false): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return `${d} de ${MESES[m - 1]}${conAnio ? ` de ${a}` : ''}`;
}

/** "Hoy", "Ayer", "martes 14 de octubre", "Semana del 13 al 19 de octubre", "Octubre de 2026". */
export function nombrePeriodo(p: Periodo, hoy: Dia): string {
  if (p.tipo === 'dia') {
    if (p.desde === hoy) return 'Hoy';
    if (p.desde === sumarDias(hoy, -1)) return 'Ayer';
    return `${DIAS[diaSemana(p.desde)]} ${diaLegible(p.desde)}`;
  }
  if (p.tipo === 'semana') {
    const [, md, dd] = p.desde.split('-').map(Number) as [number, number, number];
    const [, mh] = p.hasta.split('-').map(Number) as [number, number];
    const desde = md === mh ? String(dd) : diaLegible(p.desde);
    return `Semana del ${desde} al ${diaLegible(p.hasta)}`;
  }
  const [a, m] = p.desde.split('-').map(Number) as [number, number];
  const mes = MESES[m - 1]!;
  return `${mes[0]!.toUpperCase()}${mes.slice(1)} de ${a}`;
}

// ---------------------------------------------------------------------------------------------
// Resumen de ventas (KPIs)
// ---------------------------------------------------------------------------------------------

/** Lo que devuelve la base para un período (sin las ventas anuladas). */
export interface DatosResumen {
  /** Suma de los tickets. */
  totalTickets: Centavos;
  tickets: number;
  articulos: number;
  /** Ventas cargadas como total del día (sin detalle). */
  totalSinDetalle: Centavos;
  diasSinDetalle: number;
  porMedio: { medio: string; total: Centavos }[];
  porDia: { dia: Dia; total: Centavos }[];
}

export interface Kpis {
  ventaTotal: Centavos;
  tickets: number;
  /** null sin tickets. */
  ticketPromedio: Centavos | null;
  articulos: number;
  articulosPorTicket: number | null;
  /** Lo que se cargó como total del día, sin detalle (no entra en ticket promedio ni artículos). */
  totalSinDetalle: Centavos;
  diasSinDetalle: number;
  porMedio: { medio: string; total: Centavos; porcentaje: number }[];
}

export function calcularKpis(d: DatosResumen): Kpis {
  const ventaTotal = d.totalTickets + d.totalSinDetalle;
  const porMedio = [...d.porMedio]
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((m) => ({ ...m, porcentaje: ventaTotal > 0 ? m.total / ventaTotal : 0 }));
  return {
    ventaTotal,
    tickets: d.tickets,
    ticketPromedio: d.tickets > 0 ? Math.round(d.totalTickets / d.tickets) : null,
    articulos: d.articulos,
    articulosPorTicket: d.tickets > 0 ? Math.round((d.articulos / d.tickets) * 10) / 10 : null,
    totalSinDetalle: d.totalSinDetalle,
    diasSinDetalle: d.diasSinDetalle,
    porMedio,
  };
}

/** Variación contra el período anterior, como fracción (0,12 = +12%); null si antes no hubo nada. */
export function variacionKpi(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || anterior === 0) return null;
  return (actual - anterior) / anterior;
}

/** "+12%", "−3%", "igual". */
export function textoVariacion(v: number | null): string | null {
  if (v === null) return null;
  const pct = Math.round(v * 100);
  if (pct === 0) return 'igual';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

// ---------------------------------------------------------------------------------------------
// Total del día (sin detalle)
// ---------------------------------------------------------------------------------------------

/** Montos por medio de pago; valida que haya al menos uno y que ninguno sea negativo. */
export function problemaTotalDia(montos: Partial<Record<MedioPago, Centavos>>): string | null {
  const valores = Object.values(montos);
  if (valores.some((m) => !Number.isSafeInteger(m) || (m as number) < 0)) return 'Hay un importe que no es válido.';
  return null;
}
