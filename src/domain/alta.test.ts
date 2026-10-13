import { describe, expect, it } from 'vitest';
import { descripcionAlta, planearAltas, validarProducto } from './catalogo';

describe('planearAltas (F07/F03: alta desde la lista)', () => {
  it('toma descripción y código de la línea, sin rubro, con el IVA de la configuración y sin costo ni precio', () => {
    const [alta] = planearAltas([{ codigo: 'AB-12', descripcion: '  Fernet  Branca 750 cc ' }], new Set(), 1050);
    expect(alta).toEqual({
      datos: { codigoInterno: 'AB-12', descripcion: 'Fernet Branca 750 cc', rubroId: null, recargoPct: null, ivaPct: 1050, costoActual: 0, precioVentaActual: 0 },
      lineas: [0],
    });
    expect(validarProducto(alta!.datos)).toEqual({});
  });

  it('sin código, o con un código que ya usa otro producto o muy largo, le da uno automático libre', () => {
    const altas = planearAltas(
      [
        { codigo: null, descripcion: 'Uno' },
        { codigo: 'p0001', descripcion: 'Dos' },
        { codigo: 'X'.repeat(31), descripcion: 'Tres' },
        { codigo: '  ', descripcion: 'Cuatro' },
      ],
      new Set(['p0001', 'p0003']),
      2100,
    );
    expect(altas.map((a) => a.datos.codigoInterno)).toEqual(['P0002', 'P0004', 'P0005', 'P0006']);
  });

  it('dos líneas con el mismo código en la lista: el segundo producto no repite el código', () => {
    const altas = planearAltas(
      [
        { codigo: 'A1', descripcion: 'Uno' },
        { codigo: 'a1 ', descripcion: 'Uno otra vez' },
        { codigo: 'B1', descripcion: 'Dos' },
      ],
      new Set(),
      2100,
    );
    // "A1" y "a1 " son la misma línea para el vínculo: un solo producto para las dos.
    expect(altas.map((a) => [a.datos.codigoInterno, a.lineas])).toEqual([
      ['A1', [0, 1]],
      ['B1', [2]],
    ]);
  });

  it('una línea repetida sin código (misma descripción) crea un solo producto', () => {
    const altas = planearAltas(
      [
        { codigo: null, descripcion: 'Yerba Playadito 1 kg' },
        { codigo: null, descripcion: 'YERBA PLAYADITO 1000 GRS' },
        { codigo: null, descripcion: 'Látex Alba', presentacion: '4 l' },
        { codigo: null, descripcion: 'Látex Alba', presentacion: '20 l' },
      ],
      new Set(),
      2100,
    );
    expect(altas.map((a) => [a.datos.descripcion, a.lineas])).toEqual([
      ['Yerba Playadito 1 kg', [0, 1]],
      ['Látex Alba 4 l', [2]],
      ['Látex Alba 20 l', [3]],
    ]);
  });
});

describe('descripcionAlta', () => {
  it('suma la presentación si la lista la trae aparte y la descripción no la dice', () => {
    expect(descripcionAlta({ codigo: null, descripcion: 'Látex Alba', presentacion: ' 4 L ' })).toBe('Látex Alba 4 L');
    expect(descripcionAlta({ codigo: null, descripcion: 'Látex Alba 4 L', presentacion: '4 l' })).toBe('Látex Alba 4 L');
    expect(descripcionAlta({ codigo: null, descripcion: 'Látex Alba', presentacion: null })).toBe('Látex Alba');
  });

  it('no se pasa del largo máximo de la descripción', () => {
    const larga = descripcionAlta({ codigo: null, descripcion: 'a'.repeat(150) });
    expect(larga).toHaveLength(120);
    expect(larga.endsWith('…')).toBe(true);
  });
});
