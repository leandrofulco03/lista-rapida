import { CIEN_POR_CIENTO, validarCentavos, validarPorcentaje } from './dinero';
import type { Centavos, Porcentaje } from './dinero';

/**
 * Regla de redondeo del precio de venta (F01/F08). Siempre hacia arriba.
 * - multiplo: al próximo múltiplo de $10, $50 o $100.
 * - terminado: al próximo precio en pesos enteros que termine en 90 o 99 (1.234 → 1.290 / 1.299).
 */
export type ReglaRedondeo =
  | { tipo: 'multiplo'; pesos: 10 | 50 | 100 }
  | { tipo: 'terminado'; en: 90 | 99 };

export interface DatosPrecio {
  /** C: costo de la lista del proveedor. */
  costo: Centavos;
  /** d: descuentos del proveedor en cascada (10% + 5% = [1000, 500]). Vacío si no tiene. */
  descuentos: readonly Porcentaje[];
  /** Alícuota de IVA del producto (21% = 2100; 10,5% = 1050). */
  ivaPct: Porcentaje;
  /** La lista del proveedor trae los costos con IVA incluido. */
  listaIncluyeIva: boolean;
  /** El comercio vende con IVA incluido en el precio. */
  ventaIncluyeIva: boolean;
  /** m: recargo sobre costo, ya resuelto con resolverRecargo. */
  recargo: Porcentaje;
  redondeo: ReglaRedondeo;
}

export interface ResultadoPrecio {
  /** Precio de venta final, redondeado. */
  precio: Centavos;
  /** Si se sumó el IVA del producto en el cálculo. */
  ivaAplicado: boolean;
}

/** Recargo máximo aceptado: 1000% sobre costo. Más que eso es casi seguro un error de carga. */
export const RECARGO_MAXIMO: Porcentaje = 100_000;

const BASE = BigInt(CIEN_POR_CIENTO);
const CENTAVOS_POR_PESO = 100n;

/** El IVA se suma sólo si la lista viene sin IVA y el precio de venta lo incluye. */
export function ivaAplicable(listaIncluyeIva: boolean, ventaIncluyeIva: boolean): boolean {
  return !listaIncluyeIva && ventaIncluyeIva;
}

/**
 * F08: P = redondeo( C · (1 − d) · (1 + i) · (1 + m) ).
 *
 * El valor sin redondear se calcula como fracción exacta (BigInt) y se redondea
 * una sola vez al final, siempre hacia arriba. Así nunca queda por debajo del costo
 * ni se acumulan errores de decimales.
 */
export function calcularPrecioVenta(datos: DatosPrecio): ResultadoPrecio {
  validarCentavos(datos.costo, 'El costo');
  datos.descuentos.forEach((d, n) => validarPorcentaje(d, `El descuento ${n + 1}`, CIEN_POR_CIENTO));
  validarPorcentaje(datos.ivaPct, 'El IVA', CIEN_POR_CIENTO);
  validarPorcentaje(datos.recargo, 'El recargo', RECARGO_MAXIMO);

  const ivaAplicado = ivaAplicable(datos.listaIncluyeIva, datos.ventaIncluyeIva);
  const i = ivaAplicado ? BigInt(datos.ivaPct) : 0n;

  let numerador = BigInt(datos.costo) * (BASE + i) * (BASE + BigInt(datos.recargo));
  let denominador = BASE * BASE;
  for (const d of datos.descuentos) {
    numerador *= BASE - BigInt(d);
    denominador *= BASE;
  }

  return { precio: Number(redondear(numerador, denominador, datos.redondeo)), ivaAplicado };
}

/** Redondea hacia arriba el valor numerador/denominador (en centavos) según la regla. */
function redondear(numerador: bigint, denominador: bigint, regla: ReglaRedondeo): bigint {
  // Costo cero queda en cero: la revisión (F09) lo marca como probable error de lectura.
  if (numerador === 0n) return 0n;
  if (regla.tipo === 'multiplo') {
    const paso = BigInt(regla.pesos) * CENTAVOS_POR_PESO;
    return dividirHaciaArriba(numerador, denominador * paso) * paso;
  }
  // Precios de la forma k·$100 + $90 (o $99), con k ≥ 0: el menor que no quede por debajo del valor.
  const ciclo = 100n * CENTAVOS_POR_PESO;
  const terminacion = BigInt(regla.en) * CENTAVOS_POR_PESO;
  const excedente = numerador - terminacion * denominador;
  const k = excedente <= 0n ? 0n : dividirHaciaArriba(excedente, denominador * ciclo);
  return k * ciclo + terminacion;
}

function dividirHaciaArriba(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}
