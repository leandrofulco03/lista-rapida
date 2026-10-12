import { CIEN_POR_CIENTO } from './dinero';
import type { Porcentaje } from './dinero';
import { formatearPorcentaje, parsearPorcentaje } from './porcentaje';

/**
 * F02: descuentos del proveedor en cascada, escritos como "10 + 5" (10% y después 5%).
 * Devuelve null si algo no se entiende o algún descuento no está entre 0% y 100% (sin incluir 100%).
 * Texto vacío: sin descuentos.
 */
export function parsearDescuentos(texto: string): Porcentaje[] | null {
  const limpio = texto.trim();
  if (limpio === '') return [];
  const partes = limpio.split(/\s*\+\s*/);
  const descuentos: Porcentaje[] = [];
  for (const parte of partes) {
    const valor = parsearPorcentaje(parte);
    if (valor === null || valor <= 0 || valor >= CIEN_POR_CIENTO) return null;
    descuentos.push(valor);
  }
  return descuentos;
}

/** [1000, 500] → "10 + 5". */
export function formatearDescuentos(descuentos: readonly Porcentaje[]): string {
  return descuentos.map(formatearPorcentaje).join(' + ');
}

/** Descuento total equivalente de la cascada: 10% + 5% = 14,5%. Exacto en centésimos cuando se puede; si no, hacia abajo. */
export function descuentoEfectivo(descuentos: readonly Porcentaje[]): Porcentaje {
  let resto = 1;
  for (const d of descuentos) resto *= (CIEN_POR_CIENTO - d) / CIEN_POR_CIENTO;
  return Math.floor(Math.round((1 - resto) * CIEN_POR_CIENTO * 1e6) / 1e6);
}
