import { describe, expect, it } from 'vitest';
import { descuentoEfectivo, formatearDescuentos, parsearDescuentos } from './proveedor';

describe('descuentos del proveedor (F02)', () => {
  it.each([
    ['', []],
    ['10', [1000]],
    ['10 + 5', [1000, 500]],
    ['10%+5%', [1000, 500]],
    ['12,5 + 3', [1250, 300]],
  ])('"%s" → %j', (texto, esperado) => {
    expect(parsearDescuentos(texto)).toEqual(esperado);
  });

  it.each(['abc', '0', '100', '10 + ', '150', '-5'])('rechaza "%s"', (texto) => {
    expect(parsearDescuentos(texto)).toBeNull();
  });

  it('formatea y calcula el descuento equivalente', () => {
    expect(formatearDescuentos([1000, 500])).toBe('10 + 5');
    expect(formatearDescuentos([1250])).toBe('12,5');
    expect(descuentoEfectivo([1000, 500])).toBe(1450);
    expect(descuentoEfectivo([])).toBe(0);
  });
});
