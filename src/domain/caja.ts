import { formatearPesos } from './dinero';
import type { Centavos } from './dinero';

/**
 * Fase 10: arqueo de caja, uno por día.
 * Esperado = apertura + ventas en efectivo + pagos de fiado en efectivo + entradas − salidas (lo calcula la base).
 * Diferencia = lo contado − lo esperado: positiva, sobra plata; negativa, falta.
 */

/** "Cerró justo", "Sobran $ 500", "Faltan $ 1.200". */
export function textoDiferencia(diferencia: Centavos): string {
  if (diferencia === 0) return 'Cerró justo';
  return diferencia > 0 ? `Sobran ${formatearPesos(diferencia)}` : `Faltan ${formatearPesos(-diferencia)}`;
}

/** Cómo se ve una diferencia: justo, sobra o falta. */
export const tonoDiferencia = (diferencia: Centavos): 'justo' | 'sobra' | 'falta' =>
  diferencia === 0 ? 'justo' : diferencia > 0 ? 'sobra' : 'falta';
