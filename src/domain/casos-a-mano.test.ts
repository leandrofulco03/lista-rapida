import { describe, expect, it } from 'vitest';
import { calcularPrecioVenta } from './precio';
import type { DatosPrecio, ReglaRedondeo } from './precio';

/**
 * Condición de salida de la Fase 1: F08 coincide al centavo con 20 precios calculados a mano.
 * Como se salteó la Fase 0, los casos salen de la planilla del proyecto (plan/f08-20-casos-a-mano.csv)
 * y se calcularon por separado, paso a paso con aritmética decimal, sin usar este código.
 * Leandro validó el procedimiento con el caso 1.
 */

const M10: ReglaRedondeo = { tipo: 'multiplo', pesos: 10 };
const M50: ReglaRedondeo = { tipo: 'multiplo', pesos: 50 };
const M100: ReglaRedondeo = { tipo: 'multiplo', pesos: 100 };
const T90: ReglaRedondeo = { tipo: 'terminado', en: 90 };
const T99: ReglaRedondeo = { tipo: 'terminado', en: 99 };

type Caso = [caso: number, datos: Omit<DatosPrecio, 'ventaIncluyeIva'> & { ventaIncluyeIva?: boolean }, esperado: number];

// costo en centavos, porcentajes en centésimos de punto, esperado en centavos
const casos: Caso[] = [
  [1, { costo: 100_000, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, recargo: 3000, redondeo: M10 }, 158_000],
  [2, { costo: 245_000, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, recargo: 3500, redondeo: M50 }, 405_000],
  [3, { costo: 87_050, descuentos: [], ivaPct: 1050, listaIncluyeIva: false, recargo: 4000, redondeo: M10 }, 135_000],
  [4, { costo: 1_230_000, descuentos: [1000], ivaPct: 2100, listaIncluyeIva: false, recargo: 2500, redondeo: M100 }, 1_680_000],
  [5, { costo: 568_000, descuentos: [1000, 500], ivaPct: 2100, listaIncluyeIva: false, recargo: 3000, redondeo: T90 }, 769_000],
  [6, { costo: 39_999, descuentos: [], ivaPct: 2100, listaIncluyeIva: true, recargo: 5000, redondeo: M10 }, 60_000],
  [7, { costo: 123_456, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, recargo: 3000, redondeo: T99 }, 199_900],
  [8, { costo: 1_599_900, descuentos: [500], ivaPct: 1050, listaIncluyeIva: false, recargo: 2000, redondeo: M100 }, 2_020_000],
  [9, { costo: 74_500, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, ventaIncluyeIva: false, recargo: 4500, redondeo: M10 }, 109_000],
  [10, { costo: 333_333, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, recargo: 3333, redondeo: M50 }, 540_000],
  [11, { costo: 21_000, descuentos: [], ivaPct: 1050, listaIncluyeIva: false, recargo: 6000, redondeo: T90 }, 39_000],
  [12, { costo: 890_000, descuentos: [1500, 300], ivaPct: 2100, listaIncluyeIva: false, recargo: 2800, redondeo: M100 }, 1_140_000],
  [13, { costo: 159_000, descuentos: [], ivaPct: 2100, listaIncluyeIva: true, recargo: 0, redondeo: T90 }, 159_000],
  [14, { costo: 4_950_000, descuentos: [800], ivaPct: 2100, listaIncluyeIva: false, recargo: 1800, redondeo: M100 }, 6_510_000],
  [15, { costo: 63_240, descuentos: [], ivaPct: 2100, listaIncluyeIva: true, recargo: 3800, redondeo: T99 }, 89_900],
  [16, { costo: 200_000, descuentos: [2000, 1000, 500], ivaPct: 2100, listaIncluyeIva: false, recargo: 4000, redondeo: M50 }, 235_000],
  [17, { costo: 9_780, descuentos: [], ivaPct: 1050, listaIncluyeIva: false, recargo: 5500, redondeo: M10 }, 17_000],
  [18, { costo: 625_000, descuentos: [], ivaPct: 2100, listaIncluyeIva: false, recargo: 3250, redondeo: T99 }, 1_009_900],
  [19, { costo: 1_842_000, descuentos: [1200], ivaPct: 1050, listaIncluyeIva: false, recargo: 2200, redondeo: T90 }, 2_189_000],
  [20, { costo: 110_000, descuentos: [], ivaPct: 2100, listaIncluyeIva: true, recargo: 3000, redondeo: M50 }, 145_000],
];

describe('F08: 20 casos calculados a mano (condición de la Fase 1)', () => {
  it.each(casos)('caso %i', (_, datos, esperado) => {
    expect(calcularPrecioVenta({ ventaIncluyeIva: true, ...datos }).precio).toBe(esperado);
  });
});
