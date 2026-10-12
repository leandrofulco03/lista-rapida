import { describe, expect, it } from 'vitest';
import { desglosarPrecio } from './desglose';
import type { DatosPrecio } from './precio';

const base: DatosPrecio = {
  costo: 100_000,
  descuentos: [],
  ivaPct: 2100,
  listaIncluyeIva: false,
  ventaIncluyeIva: true,
  recargo: 3000,
  redondeo: { tipo: 'multiplo', pesos: 10 },
};

function sumar(d: ReturnType<typeof desglosarPrecio>) {
  return d.costo - d.descuento + d.iva.monto + d.recargo.monto + d.redondeo;
}

describe('desglosarPrecio', () => {
  it('ejemplo de F01: $ 1.000 + IVA $ 210 + recargo $ 363 + redondeo $ 7 = $ 1.580', () => {
    expect(desglosarPrecio(base)).toEqual({
      costo: 100_000,
      descuento: 0,
      conDescuento: 100_000,
      conIva: 121_000,
      iva: { pct: 2100, monto: 21_000, aplicado: true },
      recargo: { pct: 3000, monto: 36_300 },
      sinRedondeo: 157_300,
      redondeo: 700,
      precio: 158_000,
    });
  });

  it('el redondeo cambia según la regla elegida', () => {
    expect(desglosarPrecio({ ...base, redondeo: { tipo: 'terminado', en: 90 } })).toMatchObject({ redondeo: 1_700, precio: 159_000 });
    expect(desglosarPrecio({ ...base, redondeo: { tipo: 'multiplo', pesos: 100 } })).toMatchObject({ redondeo: 2_700, precio: 160_000 });
  });

  it('sin IVA en la venta, la línea de IVA queda en cero', () => {
    expect(desglosarPrecio({ ...base, ventaIncluyeIva: false }).iva).toEqual({ pct: 2100, monto: 0, aplicado: false });
  });

  it('con descuentos en cascada', () => {
    const d = desglosarPrecio({ ...base, descuentos: [1000, 500] });
    expect(d.descuento).toBe(14_500);
    expect(sumar(d)).toBe(d.precio);
  });

  it('las líneas siempre suman el precio, aun con fracciones de centavo', () => {
    for (let costo = 1; costo <= 500_000; costo += 7_919) {
      for (const recargo of [0, 3333, 3500, 4550]) {
        const d = desglosarPrecio({ ...base, costo, recargo, ivaPct: 1050, descuentos: [1200] });
        expect(sumar(d)).toBe(d.precio);
        expect(d.redondeo).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
