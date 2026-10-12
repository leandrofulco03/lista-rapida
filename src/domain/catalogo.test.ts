import { describe, expect, it } from 'vitest';
import { detectarColumnasCatalogo, extraerProductosCatalogo, leerAlicuota, siguienteCodigo, validarProducto } from './catalogo';
import type { DatosProducto } from './catalogo';
import type { Celda } from './importe';

const CATALOGO: Celda[][] = [
  ['Almacén Don José - Catálogo'],
  [],
  ['Código', 'Descripción', 'Rubro', 'Costo', 'Precio venta', 'IVA'],
  ['A1', 'Yerba Playadito 1 kg', 'Almacén', 3450, 5490, 0.21],
  ['A2', 'Leche entera 1 l', 'Lácteos', '1.120,50', '1.790,00', '10,5'],
  ['A2', 'Leche repetida', 'Lácteos', 1, 2, 21],
  [null, 'Pan lactal', 'Panadería', null, 2500, null],
  [null, 'Total', null, null, 99999, null],
];

describe('detectarColumnasCatalogo (F03)', () => {
  it('encuentra los títulos debajo del encabezado del archivo', () => {
    expect(detectarColumnasCatalogo(CATALOGO)).toEqual({
      mapeo: { filaEncabezado: 2, codigo: 0, descripcion: 1, rubro: 2, costo: 3, precioVenta: 4, iva: 5 },
      confianza: 'alta',
    });
  });

  it('con un solo "Precio", lo toma como precio de venta', () => {
    const { mapeo } = detectarColumnasCatalogo([['Cód', 'Producto', 'Precio'], ['1', 'Yerba', '100']]);
    expect(mapeo).toMatchObject({ codigo: 0, descripcion: 1, precioVenta: 2, costo: null });
  });

  it('sin títulos, adivina por el contenido con confianza baja', () => {
    const filas: Celda[][] = [
      ['1001', 'Aceite Natura girasol 1,5 l', '2.890,00'],
      ['1002', 'Arroz Gallo Oro 1 kg', '1.450,00'],
    ];
    expect(detectarColumnasCatalogo(filas)).toEqual({
      mapeo: { filaEncabezado: null, codigo: 0, descripcion: 1, rubro: null, costo: null, precioVenta: 2, iva: null },
      confianza: 'baja',
    });
  });
});

describe('extraerProductosCatalogo (F03)', () => {
  it('lee productos, alícuotas y saltea repetidos y totales diciendo por qué', () => {
    const { mapeo } = detectarColumnasCatalogo(CATALOGO);
    const { productos, salteadas } = extraerProductosCatalogo(CATALOGO, mapeo!);
    expect(productos).toEqual([
      { codigo: 'A1', descripcion: 'Yerba Playadito 1 kg', rubro: 'Almacén', costo: 345000, precioVenta: 549000, ivaPct: 2100, filaOrigen: 4 },
      { codigo: 'A2', descripcion: 'Leche entera 1 l', rubro: 'Lácteos', costo: 112050, precioVenta: 179000, ivaPct: 1050, filaOrigen: 5 },
      { codigo: null, descripcion: 'Pan lactal', rubro: 'Panadería', costo: null, precioVenta: 250000, ivaPct: null, filaOrigen: 7 },
    ]);
    expect(salteadas.map((s) => [s.fila, s.motivo])).toEqual([
      [6, 'repetido'],
      [8, 'total'],
    ]);
  });

  it('sin columna de rubro, los títulos de rubro se aplican a los productos de abajo', () => {
    const filas: Celda[][] = [
      ['Código', 'Descripción', 'Precio'],
      ['BEBIDAS'],
      ['B1', 'Agua 2 l', 900],
      [null, 'LIMPIEZA', null],
      ['L1', 'Lavandina 1 l', 700],
    ];
    const { mapeo } = detectarColumnasCatalogo(filas);
    const { productos, salteadas } = extraerProductosCatalogo(filas, mapeo!);
    expect(productos.map((p) => [p.codigo, p.rubro])).toEqual([
      ['B1', 'BEBIDAS'],
      ['L1', 'LIMPIEZA'],
    ]);
    expect(salteadas.map((s) => s.motivo)).toEqual(['titulo', 'titulo']);
  });
});

describe('leerAlicuota', () => {
  it.each([
    [21, 2100],
    [0.21, 2100],
    [0.105, 1050],
    ['10,5%', 1050],
    ['IVA 21', 2100],
    ['27', null],
    ['exento', null],
    [null, null],
  ] as const)('%s → %s', (celda, esperado) => {
    expect(leerAlicuota(celda)).toBe(esperado);
  });
});

describe('validarProducto y siguienteCodigo', () => {
  const valido: DatosProducto = {
    codigoInterno: 'A1',
    descripcion: 'Yerba',
    rubroId: null,
    recargoPct: null,
    ivaPct: 2100,
    costoActual: 100,
    precioVentaActual: 200,
  };

  it('acepta un producto válido y marca los campos con problemas', () => {
    expect(validarProducto(valido)).toEqual({});
    expect(Object.keys(validarProducto({ ...valido, codigoInterno: ' ', descripcion: '', ivaPct: 2700, recargoPct: -1 }))).toEqual([
      'codigoInterno',
      'descripcion',
      'recargoPct',
      'ivaPct',
    ]);
  });

  it('da el próximo código libre', () => {
    expect(siguienteCodigo(new Set(['p0001', 'p0003']))).toEqual({ codigo: 'P0002', numero: 2 });
  });
});
