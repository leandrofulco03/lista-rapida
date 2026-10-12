import type { Porcentaje } from './dinero';

export type OrigenRecargo = 'producto' | 'rubro' | 'general';

export interface RecargosDisponibles {
  /** Recargo propio del producto; null o ausente si no tiene. Un 0 explícito es válido. */
  producto?: Porcentaje | null;
  /** Recargo del rubro del producto; null o ausente si no tiene. */
  rubro?: Porcentaje | null;
  /** Recargo general del comercio (F01). */
  general: Porcentaje;
}

/** F08: el recargo se toma del producto; si no tiene, del rubro; si no, el general. */
export function resolverRecargo(recargos: RecargosDisponibles): { recargo: Porcentaje; origen: OrigenRecargo } {
  if (recargos.producto != null) return { recargo: recargos.producto, origen: 'producto' };
  if (recargos.rubro != null) return { recargo: recargos.rubro, origen: 'rubro' };
  return { recargo: recargos.general, origen: 'general' };
}
