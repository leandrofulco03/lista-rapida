import { describe, expect, it } from 'vitest';
import { detectarColumnas, ivaDesdeTitulo, puntajeTitulo } from './columnas';
import type { MapeoColumnas } from './columnas';
import type { Celda } from './importe';
import { aplicarMapeoGuardado, extraerLineas, proporcionLeida } from './lectura';

const LISTA_SIMPLE: Celda[][] = [
  ['Distribuidora El Sol S.A.', null, null, null],
  ['Lista de precios al 01/10/2026', null, null, null],
  [],
  ['Código', 'Descripción', 'Presentación', 'Precio s/IVA'],
  ['A001', 'Yerba Playadito', '1 kg', '$ 3.450,00'],
  ['A002', 'Fideos Matarazzo tirabuzón', '500 g', '1.120,50'],
  [null, 'LIMPIEZA', null, null],
  ['L010', 'Lavandina Ayudín', '1 l', 'Consultar'],
  ['L011', 'Detergente Magistral', '750 ml', 2890],
  [null, 'Total', null, '7.460,50'],
];

describe('puntajeTitulo', () => {
  it('reconoce títulos comunes', () => {
    expect(puntajeTitulo('codigo', 'Cód. Art.')).toBe(3);
    expect(puntajeTitulo('descripcion', 'DESCRIPCIÓN')).toBe(3);
    expect(puntajeTitulo('costo', 'Precio Lista')).toBe(3);
    expect(puntajeTitulo('presentacion', 'Contenido')).toBe(3);
  });

  it('no confunde el precio sugerido ni el código con la descripción', () => {
    expect(puntajeTitulo('costo', 'Precio sugerido')).toBe(0);
    expect(puntajeTitulo('costo', 'PVP')).toBe(0);
    expect(puntajeTitulo('costo', 'Cantidad')).toBe(0);
    expect(puntajeTitulo('descripcion', 'Código artículo')).toBe(0);
  });

  it('prefiere el precio unitario al del bulto', () => {
    expect(puntajeTitulo('costo', 'Precio unitario')).toBeGreaterThan(puntajeTitulo('costo', 'Precio x bulto'));
  });
});

describe('ivaDesdeTitulo', () => {
  it.each([
    ['Precio c/IVA', true],
    ['Precio con IVA', true],
    ['Precio final', true],
    ['Precio s/IVA', false],
    ['Precio + IVA', false],
    ['Neto', false],
    ['Precio', null],
  ])('%s → %s', (titulo, esperado) => {
    expect(ivaDesdeTitulo(titulo)).toBe(esperado);
  });
});

describe('detectarColumnas', () => {
  it('encuentra la fila de títulos debajo de los datos del proveedor', () => {
    const { mapeo, confianza } = detectarColumnas(LISTA_SIMPLE);
    expect(confianza).toBe('alta');
    expect(mapeo).toMatchObject({ filaEncabezado: 3, codigo: 0, descripcion: 1, presentacion: 2, costo: 3 });
    expect(mapeo?.titulos).toEqual({
      codigo: 'codigo',
      descripcion: 'descripcion',
      presentacion: 'presentacion',
      costo: 'precio s/iva',
    });
  });

  it('con dos precios elige el de lista y no el sugerido', () => {
    const filas: Celda[][] = [
      ['Artículo', 'Detalle', 'Precio sugerido', 'Precio lista'],
      ['1', 'Galletitas Express', '1.500', '1.000'],
      ['2', 'Galletitas Criollitas', '1.800', '1.200'],
    ];
    expect(detectarColumnas(filas).mapeo).toMatchObject({ codigo: 0, descripcion: 1, costo: 3 });
  });

  it('sin títulos adivina por el contenido, con confianza baja', () => {
    const filas: Celda[][] = [
      ['10023', 'Aceite Natura girasol', '1,5 lt', '2.890,00'],
      ['10024', 'Aceite Cocinero mezcla', '900 ml', '1.990,00'],
      ['10025', 'Arroz Gallo oro largo fino', '1 kg', '1.450,00'],
      ['10026', 'Harina Pureza leudante', '1 kg', '990,00'],
    ];
    const { mapeo, confianza } = detectarColumnas(filas);
    expect(confianza).toBe('baja');
    expect(mapeo).toEqual({
      filaEncabezado: null,
      codigo: 0,
      descripcion: 1,
      costo: 3,
      presentacion: 2,
      titulos: null,
    });
  });

  it('un archivo sin nada parecido a una lista no devuelve mapeo', () => {
    expect(detectarColumnas([['hola'], ['chau']]).mapeo).toBeNull();
    expect(detectarColumnas([]).mapeo).toBeNull();
  });
});

describe('extraerLineas', () => {
  const mapeo = detectarColumnas(LISTA_SIMPLE).mapeo!;

  it('lee los productos con su fila de origen y saltea rubros, totales y precios raros diciendo por qué', () => {
    const { lineas, salteadas } = extraerLineas(LISTA_SIMPLE, mapeo);
    expect(lineas).toEqual([
      { codigo: 'A001', descripcion: 'Yerba Playadito', presentacion: '1 kg', costo: 345_000, ivaIncluido: false, filaOrigen: 5 },
      { codigo: 'A002', descripcion: 'Fideos Matarazzo tirabuzón', presentacion: '500 g', costo: 112_050, ivaIncluido: false, filaOrigen: 6 },
      { codigo: 'L011', descripcion: 'Detergente Magistral', presentacion: '750 ml', costo: 289_000, ivaIncluido: false, filaOrigen: 9 },
    ]);
    expect(salteadas).toEqual([
      { fila: 7, motivo: 'titulo', texto: 'LIMPIEZA' },
      { fila: 8, motivo: 'sin-precio', texto: 'L010 · Lavandina Ayudín · 1 l · Consultar' },
      { fila: 10, motivo: 'total', texto: 'Total · 7.460,50' },
    ]);
  });

  it('saltea los títulos repetidos en cada página', () => {
    const filas = [...LISTA_SIMPLE.slice(0, 6), ['Código', 'Descripción', 'Presentación', 'Precio s/IVA'], LISTA_SIMPLE[8]!];
    const { lineas, salteadas } = extraerLineas(filas, mapeo);
    expect(lineas).toHaveLength(3);
    expect(salteadas.map((s) => s.motivo)).toEqual(['encabezado']);
  });

  it('respeta el formato con punto decimal de la columna', () => {
    const filas: Celda[][] = [
      ['Descripcion', 'Precio'],
      ['Café', '1.234'],
      ['Té', '850.50'],
      ['Mate', '99.9'],
    ];
    const { lineas } = extraerLineas(filas, detectarColumnas(filas).mapeo!);
    expect(lineas.map((l) => l.costo)).toEqual([123, 85_050, 9_990]);
  });

  it('acepta costo cero (la revisión lo marca después)', () => {
    const filas: Celda[][] = [
      ['Descripcion', 'Precio'],
      ['Bolsa', '0'],
    ];
    expect(extraerLineas(filas, detectarColumnas(filas).mapeo!).lineas[0]?.costo).toBe(0);
  });

  it('proporcionLeida no cuenta rubros ni totales como fallas', () => {
    expect(proporcionLeida(extraerLineas(LISTA_SIMPLE, mapeo))).toBe(3 / 4);
  });
});

describe('aplicarMapeoGuardado (F06)', () => {
  const guardado = detectarColumnas(LISTA_SIMPLE).mapeo!;

  it('reencuentra las columnas aunque el proveedor agregue filas arriba y reordene', () => {
    const nueva: Celda[][] = [
      ['Distribuidora El Sol S.A.'],
      ['Lista de precios al 15/10/2026'],
      ['Vigencia: 15 días'],
      [],
      ['Descripción', 'Código', 'Precio s/IVA', 'Presentación', 'Stock'],
      ['Yerba Playadito', 'A001', '3.600,00', '1 kg', 'Sí'],
      ['Fideos Matarazzo tirabuzón', 'A002', '1.190,00', '500 g', 'No'],
    ];
    const mapeo = aplicarMapeoGuardado(nueva, guardado);
    expect(mapeo).toMatchObject({ filaEncabezado: 4, descripcion: 0, codigo: 1, costo: 2, presentacion: 3 });
    expect(extraerLineas(nueva, mapeo!).lineas.map((l) => l.costo)).toEqual([360_000, 119_000]);
  });

  it('si cambiaron los títulos, pide el mapeo de nuevo', () => {
    const nueva: Celda[][] = [
      ['Cod', 'Artículo', 'Importe'],
      ['A001', 'Yerba Playadito', '3.600,00'],
    ];
    expect(aplicarMapeoGuardado(nueva, guardado)).toBeNull();
  });

  it('sin títulos reusa las posiciones si los datos se leen bien', () => {
    const sinTitulos: MapeoColumnas = { filaEncabezado: null, codigo: 0, descripcion: 1, costo: 2, presentacion: null, titulos: null };
    expect(aplicarMapeoGuardado([['1', 'Sal fina', '500']], sinTitulos)).toEqual(sinTitulos);
    expect(aplicarMapeoGuardado([['1', 'Sal fina', 'Sin stock']], sinTitulos)).toBeNull();
  });
});
