import type { Centavos } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { Dia } from '../domain/ventas';
import type { Sesion } from './tipos';

/** Fase 10: gastos fijos por mes y resultado neto (sólo el dueño). Los meses van como su primer día: "2026-10-01". */

export interface GastoDelMes {
  id: Id;
  nombre: string;
  archivado: boolean;
  /** Lo cargado este mes; null si todavía no. */
  monto: Centavos | null;
  /** Lo del último mes anterior cargado, para proponerlo. */
  montoAnterior: Centavos | null;
}

const numero = (n: unknown): number | null => (n === null || n === undefined ? null : Number(n));

export async function leerGastos(s: Sesion, mes: Dia): Promise<GastoDelMes[]> {
  const filas = await s.backend.rpc<GastoDelMes[]>('leer_gastos', { c: s.comercioId, mes });
  return filas.map((g) => ({ ...g, monto: numero(g.monto), montoAnterior: numero(g.montoAnterior) }));
}

export async function guardarGasto(s: Sesion, id: Id, nombre: string): Promise<void> {
  await s.backend.rpc('guardar_gasto', { c: s.comercioId, id, nombre });
}

export async function archivarGasto(s: Sesion, id: Id, archivado: boolean): Promise<void> {
  await s.backend.rpc('archivar_gasto', { c: s.comercioId, id, archivado });
}

/** Reemplaza los montos del mes de los gastos que vienen; un monto en cero o null lo saca. */
export async function guardarGastosMes(s: Sesion, mes: Dia, montos: Record<Id, Centavos | null>): Promise<void> {
  await s.backend.rpc('guardar_gastos_mes', { c: s.comercioId, mes, montos });
}

export interface DatosMes {
  mes: Dia;
  /** Todo lo vendido (tickets y total del día). */
  ventas: Centavos;
  /** Lo vendido de productos con costo, y lo que costó: de ahí sale la ganancia. */
  ventasConCosto: Centavos;
  costo: Centavos;
  gastos: Centavos;
}

export async function resultadoMeses(s: Sesion, desde: Dia, hasta: Dia): Promise<DatosMes[]> {
  const filas = await s.backend.rpc<DatosMes[]>('resultado_meses', { c: s.comercioId, desde, hasta });
  return filas.map((f) => ({
    mes: f.mes,
    ventas: Number(f.ventas),
    ventasConCosto: Number(f.ventasConCosto),
    costo: Number(f.costo),
    gastos: Number(f.gastos),
  }));
}
