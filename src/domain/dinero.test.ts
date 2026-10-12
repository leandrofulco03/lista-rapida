import { describe, expect, it } from 'vitest';
import { formatearPesos } from './dinero';

describe('formatearPesos', () => {
  it.each([
    [1_234_550, '$ 12.345,50'],
    [0, '$ 0,00'],
    [5, '$ 0,05'],
    [130_000, '$ 1.300,00'],
    [100_000_000, '$ 1.000.000,00'],
    [-150, '-$ 1,50'],
  ])('%i → %s', (centavos, texto) => {
    expect(formatearPesos(centavos)).toBe(texto);
  });

  it('rechaza montos con decimales', () => {
    expect(() => formatearPesos(1.5)).toThrow(RangeError);
  });
});
