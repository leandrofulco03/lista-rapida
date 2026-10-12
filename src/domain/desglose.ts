import { CIEN_POR_CIENTO } from './dinero';
import type { Centavos, Porcentaje } from './dinero';
import { calcularPrecioVenta, ivaAplicable } from './precio';
import type { DatosPrecio } from './precio';

/**
 * Desglose del precio de venta para mostrar en pantalla (F01/F09):
 * costo − descuentos + IVA + recargo + redondeo = precio.
 *
 * Los montos intermedios se redondean al centavo sólo para mostrarlos, y cada
 * línea se calcula como diferencia de subtotales, así la suma de lo que se ve
 * da exactamente el precio final. El precio sale siempre de calcularPrecioVenta.
 */
export interface DesglosePrecio {
  costo: Centavos;
  /** Suma de todos los descuentos en cascada (monto positivo que se resta). */
  descuento: Centavos;
  /** Subtotal después de los descuentos, al centavo. */
  conDescuento: Centavos;
  /** Subtotal después del IVA, al centavo. */
  conIva: Centavos;
  iva: { pct: Porcentaje; monto: Centavos; aplicado: boolean };
  recargo: { pct: Porcentaje; monto: Centavos };
  /** Precio antes de redondear, al centavo. */
  sinRedondeo: Centavos;
  /** Lo que sube el redondeo (siempre ≥ 0). */
  redondeo: Centavos;
  precio: Centavos;
}

const BASE = BigInt(CIEN_POR_CIENTO);

export function desglosarPrecio(datos: DatosPrecio): DesglosePrecio {
  const { precio, ivaAplicado } = calcularPrecioVenta(datos);

  let num = BigInt(datos.costo);
  let den = 1n;
  for (const d of datos.descuentos) {
    num *= BASE - BigInt(d);
    den *= BASE;
  }
  const conDescuento = alCentavo(num, den);

  const i = ivaAplicable(datos.listaIncluyeIva, datos.ventaIncluyeIva) ? BigInt(datos.ivaPct) : 0n;
  num *= BASE + i;
  den *= BASE;
  const conIva = alCentavo(num, den);

  num *= BASE + BigInt(datos.recargo);
  den *= BASE;
  const sinRedondeo = alCentavo(num, den);

  return {
    costo: datos.costo,
    descuento: datos.costo - conDescuento,
    conDescuento,
    conIva,
    iva: { pct: datos.ivaPct, monto: conIva - conDescuento, aplicado: ivaAplicado },
    recargo: { pct: datos.recargo, monto: sinRedondeo - conIva },
    sinRedondeo,
    // Con fracciones de centavo, sinRedondeo puede quedar medio centavo arriba del precio exacto.
    redondeo: Math.max(0, precio - sinRedondeo),
    precio,
  };
}

/** Redondeo al centavo más cercano (mitad hacia arriba), sólo para mostrar. */
function alCentavo(num: bigint, den: bigint): Centavos {
  return Number((2n * num + den) / (2n * den));
}
