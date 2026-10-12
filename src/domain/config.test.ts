import { describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA, normalizarConfig, validarConfig } from './config';
import type { ConfigComercio } from './config';

const valida: ConfigComercio = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén Don José' };

describe('F01: validarConfig', () => {
  it('la configuración sugerida con nombre es válida', () => {
    expect(validarConfig(valida)).toEqual({});
  });

  it('los valores sugeridos son los acordados', () => {
    expect(CONFIG_SUGERIDA).toMatchObject({
      recargoGeneral: 3000,
      redondeo: { tipo: 'multiplo', pesos: 10 },
      ventaIncluyeIva: true,
      ivaDefault: 2100,
    });
  });

  it('pide el nombre', () => {
    expect(validarConfig({ ...valida, nombreComercio: '   ' })).toHaveProperty('nombreComercio');
  });

  it('limita el largo del nombre', () => {
    expect(validarConfig({ ...valida, nombreComercio: 'x'.repeat(61) })).toHaveProperty('nombreComercio');
    expect(validarConfig({ ...valida, nombreComercio: 'x'.repeat(60) })).toEqual({});
  });

  it.each([-1, 100_001, 30.5])('rechaza recargo %s', (recargoGeneral) => {
    expect(validarConfig({ ...valida, recargoGeneral })).toHaveProperty('recargoGeneral');
  });

  it('acepta recargo 0', () => {
    expect(validarConfig({ ...valida, recargoGeneral: 0 })).toEqual({});
  });

  it('rechaza un redondeo que no está en la lista', () => {
    const redondeo = { tipo: 'multiplo', pesos: 20 } as unknown as ConfigComercio['redondeo'];
    expect(validarConfig({ ...valida, redondeo })).toHaveProperty('redondeo');
  });

  it('sólo acepta IVA 21% o 10,5%', () => {
    expect(validarConfig({ ...valida, ivaDefault: 1050 })).toEqual({});
    expect(validarConfig({ ...valida, ivaDefault: 2700 })).toHaveProperty('ivaDefault');
  });
});

describe('F01: normalizarConfig', () => {
  it('saca espacios de más del nombre', () => {
    expect(normalizarConfig({ ...valida, nombreComercio: '  Almacén   Don  José ' }).nombreComercio).toBe('Almacén Don José');
  });
});
