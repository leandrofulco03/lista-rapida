import type { DatosAnalisis } from '../domain/analisis';
import type { Centavos } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { Dia } from '../domain/ventas';
import type { Sesion } from './tipos';

/** Fase 9: análisis (sólo el dueño). Los números de tipo numeric llegan como texto desde Supabase: se pasan a número. */

const n = (v: unknown): number => Number(v);
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function analisisVentas(s: Sesion, desde: Dia, hasta: Dia): Promise<DatosAnalisis> {
  const d = await s.backend.rpc<DatosAnalisis>('analisis_ventas', { c: s.comercioId, desde, hasta });
  return {
    ganancia: { ventasConCosto: n(d.ganancia.ventasConCosto), costo: n(d.ganancia.costo), ventasSinCosto: n(d.ganancia.ventasSinCosto) },
    productos: d.productos.map((p) => ({ ...p, unidades: n(p.unidades), importe: n(p.importe), ganancia: nn(p.ganancia) })),
    rubros: d.rubros.map((r) => ({ ...r, importe: n(r.importe) })),
    horas: d.horas.map((h) => ({ diaSemana: n(h.diaSemana), hora: n(h.hora), importe: n(h.importe), ventas: n(h.ventas) })),
  };
}

export interface SinMovimiento {
  productoId: Id;
  descripcion: string;
  precioVentaActual: Centavos;
  costoActual: Centavos;
  /** null: nunca se vendió. */
  ultimaVenta: Dia | null;
}

/** Productos sin ventas en los últimos `dias` días. */
export async function sinMovimiento(s: Sesion, dias = 30): Promise<SinMovimiento[]> {
  const lista = await s.backend.rpc<SinMovimiento[]>('sin_movimiento', { c: s.comercioId, dias });
  return lista.map((p) => ({ ...p, precioVentaActual: n(p.precioVentaActual), costoActual: n(p.costoActual) }));
}
