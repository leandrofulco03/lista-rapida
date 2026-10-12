import { describe, expect, it } from 'vitest';
import { calcularPrecioVenta, ivaAplicable } from './precio';
import type { DatosPrecio, ReglaRedondeo } from './precio';

const M10: ReglaRedondeo = { tipo: 'multiplo', pesos: 10 };
const M50: ReglaRedondeo = { tipo: 'multiplo', pesos: 50 };
const M100: ReglaRedondeo = { tipo: 'multiplo', pesos: 100 };
const T90: ReglaRedondeo = { tipo: 'terminado', en: 90 };
const T99: ReglaRedondeo = { tipo: 'terminado', en: 99 };

/** Lista sin IVA, venta con IVA 21%, sin descuentos, recargo 30%, redondeo a $10. */
function datos(cambios: Partial<DatosPrecio> = {}): DatosPrecio {
  return {
    costo: 100_000,
    descuentos: [],
    ivaPct: 2100,
    listaIncluyeIva: false,
    ventaIncluyeIva: true,
    recargo: 3000,
    redondeo: M10,
    ...cambios,
  };
}

const precio = (cambios: Partial<DatosPrecio>) => calcularPrecioVenta(datos(cambios)).precio;

describe('F08: calcularPrecioVenta', () => {
  it('ejemplo de la spec: 30% de recargo sobre $ 1.000 da $ 1.300', () => {
    expect(precio({ listaIncluyeIva: true })).toBe(130_000);
  });

  describe('lista sin IVA: $ 1.000 × 1,21 × 1,30 = $ 1.573', () => {
    it.each([
      ['múltiplo de $10', M10, 158_000],
      ['múltiplo de $50', M50, 160_000],
      ['múltiplo de $100', M100, 160_000],
      ['terminado en 90', T90, 159_000],
      ['terminado en 99', T99, 159_900],
    ])('%s', (_, redondeo, esperado) => {
      expect(precio({ redondeo })).toBe(esperado);
    });
  });

  describe('descuentos en cascada 10% + 5%: $ 1.000 × 0,90 × 0,95 × 1,21 × 1,30 = $ 1.344,915', () => {
    it.each([
      ['múltiplo de $10', M10, 135_000],
      ['múltiplo de $50', M50, 135_000],
      ['múltiplo de $100', M100, 140_000],
      ['terminado en 90', T90, 139_000],
      ['terminado en 99', T99, 139_900],
    ])('%s', (_, redondeo, esperado) => {
      expect(precio({ descuentos: [1000, 500], redondeo })).toBe(esperado);
    });
  });

  it('IVA 10,5%: $ 1.000 × 1,105 × 1,30 = $ 1.436,50 → $ 1.440', () => {
    expect(precio({ ivaPct: 1050 })).toBe(144_000);
    expect(precio({ ivaPct: 1050, redondeo: T90 })).toBe(149_000);
  });

  describe('IVA', () => {
    it('lista con IVA y venta con IVA: no se vuelve a sumar', () => {
      const r = calcularPrecioVenta(datos({ listaIncluyeIva: true }));
      expect(r).toEqual({ precio: 130_000, ivaAplicado: false });
    });

    it('lista sin IVA y venta sin IVA: no se suma', () => {
      const r = calcularPrecioVenta(datos({ ventaIncluyeIva: false }));
      expect(r).toEqual({ precio: 130_000, ivaAplicado: false });
    });

    it('ivaAplicable sólo con lista sin IVA y venta con IVA', () => {
      expect(ivaAplicable(false, true)).toBe(true);
      expect(ivaAplicable(true, true)).toBe(false);
      expect(ivaAplicable(false, false)).toBe(false);
      expect(ivaAplicable(true, false)).toBe(false);
    });
  });

  describe('redondeo en los bordes', () => {
    it('un valor que ya es múltiplo exacto no sube', () => {
      expect(precio({ listaIncluyeIva: true, recargo: 5000, redondeo: M100 })).toBe(150_000);
      expect(precio({ listaIncluyeIva: true, recargo: 5000, redondeo: M50 })).toBe(150_000);
    });

    it('terminado en 90: $ 1.500 sube a $ 1.590', () => {
      expect(precio({ listaIncluyeIva: true, recargo: 5000, redondeo: T90 })).toBe(159_000);
    });

    it('terminado en 90: $ 1.590 justo queda igual y $ 1.590,01 salta a $ 1.690', () => {
      expect(precio({ costo: 159_000, listaIncluyeIva: true, recargo: 0, redondeo: T90 })).toBe(159_000);
      expect(precio({ costo: 159_001, listaIncluyeIva: true, recargo: 0, redondeo: T90 })).toBe(169_000);
    });

    it('terminado en 99: $ 1.299,50 sube a $ 1.399 (no baja a $ 1.299)', () => {
      expect(precio({ costo: 129_950, listaIncluyeIva: true, recargo: 0, redondeo: T99 })).toBe(139_900);
    });

    it('precios chicos: $ 26,99 con 35% ($ 36,4365) → $ 40 / $ 90 / $ 99', () => {
      const base = { costo: 2699, listaIncluyeIva: true, recargo: 3500 };
      expect(precio({ ...base, redondeo: M10 })).toBe(4000);
      expect(precio({ ...base, redondeo: T90 })).toBe(9000);
      expect(precio({ ...base, redondeo: T99 })).toBe(9900);
    });

    it('sin errores de decimales: $ 333,33 con 33,33% ($ 444,428889) → $ 450', () => {
      expect(precio({ costo: 33_333, listaIncluyeIva: true, recargo: 3333 })).toBe(45_000);
    });
  });

  describe('nunca por debajo del costo', () => {
    it('con recargo 0 el precio es mayor o igual al costo en todas las reglas', () => {
      for (const redondeo of [M10, M50, M100, T90, T99]) {
        for (let costo = 1; costo <= 2_000_000; costo += 9_973) {
          const p = precio({ costo, listaIncluyeIva: true, recargo: 0, redondeo });
          expect(p).toBeGreaterThanOrEqual(costo);
        }
      }
    });

    it('el redondeo sube menos de un paso', () => {
      for (let costo = 1; costo <= 2_000_000; costo += 9_973) {
        const p = precio({ costo, listaIncluyeIva: true, recargo: 0, redondeo: M100 });
        expect(p - costo).toBeLessThan(10_000);
        expect(p % 10_000).toBe(0);
      }
    });
  });

  describe('casos límite', () => {
    it('costo cero da precio cero (F09 lo marca)', () => {
      for (const redondeo of [M10, M100, T90, T99]) expect(precio({ costo: 0, redondeo })).toBe(0);
    });

    it('descuento del 100% da precio cero', () => {
      expect(precio({ descuentos: [10_000] })).toBe(0);
    });

    it.each([
      ['costo negativo', { costo: -1 }],
      ['costo con decimales', { costo: 100.5 }],
      ['descuento mayor a 100%', { descuentos: [10_001] }],
      ['descuento negativo', { descuentos: [-100] }],
      ['IVA con decimales', { ivaPct: 21.5 }],
      ['recargo negativo', { recargo: -1 }],
      ['recargo mayor a 1000%', { recargo: 100_001 }],
    ])('rechaza %s', (_, cambios) => {
      expect(() => calcularPrecioVenta(datos(cambios))).toThrow(RangeError);
    });
  });
});
