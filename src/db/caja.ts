import type { Centavos } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { Dia } from '../domain/ventas';
import type { Sesion } from './tipos';

/**
 * Fase 10: arqueo de caja, uno por día. El empleado abre, anota y cierra la de hoy;
 * el esperado y la diferencia los ve sólo el dueño (el empleado cuenta "a ciegas").
 */

export interface MovimientoCaja {
  id: Id;
  fecha: string;
  tipo: 'entrada' | 'salida';
  monto: Centavos;
  motivo: string;
  propio: boolean;
  quien: string | null;
}

export interface Esperado {
  apertura: Centavos;
  ventasEfectivo: Centavos;
  pagosFiadoEfectivo: Centavos;
  entradas: Centavos;
  salidas: Centavos;
  esperado: Centavos;
}

export interface Caja {
  dia: Dia;
  abierta: boolean;
  apertura: Centavos | null;
  /** Lo que se contó al cerrar el último día anterior (para abrir con eso). */
  aperturaSugerida: Centavos | null;
  cerrada: boolean;
  contado: Centavos | null;
  nota: string | null;
  cerradaEn: string | null;
  cerradaPor: string | null;
  movimientos: MovimientoCaja[];
  /** Sólo el dueño. */
  esperado: Esperado | null;
  /** Sólo el dueño, con la caja cerrada: contado − esperado. */
  diferencia: Centavos | null;
}

const numero = (n: unknown): number | null => (n === null || n === undefined ? null : Number(n));

export async function leerCaja(s: Sesion, dia: Dia): Promise<Caja> {
  const k = await s.backend.rpc<Caja>('leer_caja', { c: s.comercioId, dia });
  const e = k.esperado;
  return {
    ...k,
    apertura: numero(k.apertura),
    aperturaSugerida: numero(k.aperturaSugerida),
    contado: numero(k.contado),
    diferencia: numero(k.diferencia),
    movimientos: k.movimientos.map((m) => ({ ...m, monto: Number(m.monto) })),
    esperado: e && {
      apertura: Number(e.apertura),
      ventasEfectivo: Number(e.ventasEfectivo),
      pagosFiadoEfectivo: Number(e.pagosFiadoEfectivo),
      entradas: Number(e.entradas),
      salidas: Number(e.salidas),
      esperado: Number(e.esperado),
    },
  };
}

/** Abre la caja con lo que hay en el cajón (o corrige la apertura mientras está abierta). */
export async function abrirCaja(s: Sesion, dia: Dia, apertura: Centavos): Promise<void> {
  await s.backend.rpc('abrir_caja', { c: s.comercioId, dia, apertura });
}

export async function movimientoCaja(s: Sesion, dia: Dia, movimiento: { tipo: 'entrada' | 'salida'; monto: Centavos; motivo: string }): Promise<void> {
  await s.backend.rpc('movimiento_caja', { c: s.comercioId, dia, movimiento });
}

export async function anularMovimientoCaja(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('anular_movimiento_caja', { c: s.comercioId, id });
}

export async function cerrarCaja(s: Sesion, dia: Dia, contado: Centavos, nota = ''): Promise<void> {
  await s.backend.rpc('cerrar_caja', { c: s.comercioId, dia, contado, nota });
}

export async function reabrirCaja(s: Sesion, dia: Dia): Promise<void> {
  await s.backend.rpc('reabrir_caja', { c: s.comercioId, dia });
}

export interface CajaDelHistorial {
  dia: Dia;
  apertura: Centavos;
  contado: Centavos | null;
  esperado: Centavos;
  diferencia: Centavos | null;
}

export async function historialCajas(s: Sesion, desde: Dia, hasta: Dia): Promise<CajaDelHistorial[]> {
  const filas = await s.backend.rpc<CajaDelHistorial[]>('historial_cajas', { c: s.comercioId, desde, hasta });
  return filas.map((f) => ({
    dia: f.dia,
    apertura: Number(f.apertura),
    contado: numero(f.contado),
    esperado: Number(f.esperado),
    diferencia: numero(f.diferencia),
  }));
}
