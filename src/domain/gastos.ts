import type { Centavos } from './dinero';
import type { Dia } from './ventas';

/**
 * Fase 10: resultado neto del mes = ganancia de lo vendido − gastos fijos del mes.
 * La ganancia es la de Análisis: sólo de lo vendido con costo conocido. Lo vendido sin costo ("Varios", total del día,
 * productos sin costo) no entra, y se informa aparte para que se sepa que el resultado real puede ser mayor.
 */

export interface Resultado {
  ventas: Centavos;
  ganancia: Centavos;
  gastos: Centavos;
  neto: Centavos;
  /** Lo vendido que no entra en la ganancia porque no tiene costo. */
  sinCosto: Centavos;
}

export function calcularResultado(d: { ventas: Centavos; ventasConCosto: Centavos; costo: Centavos; gastos: Centavos }): Resultado {
  const ganancia = d.ventasConCosto - d.costo;
  return { ventas: d.ventas, ganancia, gastos: d.gastos, neto: ganancia - d.gastos, sinCosto: Math.max(0, d.ventas - d.ventasConCosto) };
}

/** Primer día del mes de `dia`. */
export const mesDe = (dia: Dia): Dia => `${dia.slice(0, 7)}-01`;

/** Suma meses a un primer día de mes. */
export function sumarMeses(mes: Dia, meses: number): Dia {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Octubre de 2026"; corto: "oct". */
export function nombreMes(mes: Dia, corto = false): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const nombre = MESES[m - 1]!;
  if (corto) return nombre.slice(0, 3);
  return `${nombre[0]!.toUpperCase()}${nombre.slice(1)} de ${a}`;
}
