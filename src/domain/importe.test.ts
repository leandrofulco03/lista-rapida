import { describe, expect, it } from 'vitest';
import { detectarFormatoNumeros, leerImporte } from './importe';

describe('leerImporte: formato argentino', () => {
  it.each([
    ['$ 1.234,50', 123_450],
    ['1.234,50', 123_450],
    ['1234,50', 123_450],
    ['1234,5', 123_450],
    ['1.234', 123_400],
    ['1.234.567', 123_456_700],
    ['1.234.567,89', 123_456_789],
    ['$1.000', 100_000],
    ['850', 85_000],
    ['0,99', 99],
    ['  $  12.345,50  ', 1_234_550],
    ['12,3456', 1_235],
    ['0,995', 100],
    ['1.5', 150],
    ['1.234,5', 123_450],
    ['ARS 2.500,00', 250_000],
    ['1 234,50', 123_450],
    ['0', 0],
  ])('%s → %i', (texto, centavos) => {
    expect(leerImporte(texto)).toBe(centavos);
  });
});

describe('leerImporte: punto decimal', () => {
  it.each([
    ['1234.50', 123_450],
    ['1,234.50', 123_450],
    ['1,234', 123_400],
    ['1.234', 123],
    ['1,234,567.8', 123_456_780],
    ['99.9', 9_990],
  ])('%s → %i', (texto, centavos) => {
    expect(leerImporte(texto, 'us')).toBe(centavos);
  });

  it('con los dos separadores no importa el formato de la columna', () => {
    expect(leerImporte('1,234.50', 'ar')).toBe(123_450);
    expect(leerImporte('1.234,50', 'us')).toBe(123_450);
  });
});

describe('leerImporte: números de Excel', () => {
  it.each([
    [1234.5, 123_450],
    [1234.499999999, 123_450],
    [0.1 + 0.2, 30],
    [850, 85_000],
    [0, 0],
  ])('%d → %i', (numero, centavos) => {
    expect(leerImporte(numero)).toBe(centavos);
  });

  it('rechaza negativos e infinitos', () => {
    expect(leerImporte(-5)).toBeNull();
    expect(leerImporte(Number.NaN)).toBeNull();
    expect(leerImporte(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('leerImporte: lo que no es un precio', () => {
  it.each([null, '', '  ', '-', 'Consultar', 's/stock', '-150', '(150)', '1.23.4', '12,34,5', '1.234,5.6', '12a', 'Precio', '1e5'])(
    '%s → null',
    (valor) => {
      expect(leerImporte(valor)).toBeNull();
    },
  );
});

describe('detectarFormatoNumeros', () => {
  it('reconoce formato argentino', () => {
    expect(detectarFormatoNumeros(['1.234,50', '850', '99,90', null])).toBe('ar');
  });

  it('reconoce punto decimal', () => {
    expect(detectarFormatoNumeros(['1234.50', '850', '1,299.00', 'Consultar'])).toBe('us');
  });

  it('sin pistas asume formato argentino', () => {
    expect(detectarFormatoNumeros(['1.234', '850', 1200.5])).toBe('ar');
    expect(detectarFormatoNumeros([])).toBe('ar');
  });
});
