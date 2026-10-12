import type { Porcentaje } from './dinero';

/**
 * Lee un porcentaje escrito por el usuario: "30", "30%", "10,5", "33,33".
 * Acepta coma o punto decimal y hasta 2 decimales. Devuelve null si no se entiende.
 */
export function parsearPorcentaje(texto: string): Porcentaje | null {
  const limpio = texto.trim().replace(/\s*%$/, '').replace(',', '.');
  const partes = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!partes) return null;
  const enteros = Number(partes[1]);
  const decimales = Number((partes[2] ?? '').padEnd(2, '0'));
  return enteros * 100 + decimales;
}

/** 1050 → "10,5"; 3000 → "30"; 3333 → "33,33". */
export function formatearPorcentaje(valor: Porcentaje): string {
  const enteros = Math.floor(valor / 100);
  const decimales = valor % 100;
  if (decimales === 0) return String(enteros);
  return `${enteros},${String(decimales).padStart(2, '0').replace(/0$/, '')}`;
}

export const IVA_GENERAL: Porcentaje = 2100;
export const IVA_REDUCIDO: Porcentaje = 1050;
export const ALICUOTAS_IVA: readonly Porcentaje[] = [IVA_GENERAL, IVA_REDUCIDO];

