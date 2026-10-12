import { describe, expect, it } from 'vitest';
import { formatearPorcentaje, parsearPorcentaje } from './porcentaje';

describe('parsearPorcentaje', () => {
  it.each([
    ['30', 3000],
    ['30%', 3000],
    [' 30 % ', 3000],
    ['10,5', 1050],
    ['10.5', 1050],
    ['33,33', 3333],
    ['0', 0],
    ['150', 15_000],
  ])('"%s" → %i', (texto, esperado) => {
    expect(parsearPorcentaje(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '-5', '10,555', '1,2,3', '12345', ',5'])('rechaza "%s"', (texto) => {
    expect(parsearPorcentaje(texto)).toBeNull();
  });
});

describe('formatearPorcentaje', () => {
  it.each([
    [3000, '30'],
    [1050, '10,5'],
    [3333, '33,33'],
    [5, '0,05'],
    [0, '0'],
  ])('%i → "%s"', (valor, texto) => {
    expect(formatearPorcentaje(valor)).toBe(texto);
  });
});
