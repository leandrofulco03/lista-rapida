import { describe, expect, it } from 'vitest';
import { ALTO_A4, ANCHO_A4, FORMATOS, fechaEtiqueta, medidaEtiqueta, partirEnRenglones, precioEtiqueta, ubicarEtiquetas, validarFormato } from './etiquetas';

describe('ubicarEtiquetas', () => {
  it('reparte la hoja en partes iguales, dentro del margen, y sigue en otra hoja', () => {
    const formato = { columnas: 3, filas: 8, margen: 10 };
    expect(medidaEtiqueta(formato)).toEqual({ ancho: 190 / 3, alto: 277 / 8 });
    const hojas = ubicarEtiquetas(formato, 25);
    expect(hojas.map((h) => h.length)).toEqual([24, 1]);
    expect(hojas[0]![0]).toEqual({ x: 10, y: 10, ancho: 190 / 3, alto: 277 / 8 });
    expect(hojas[0]![4]).toMatchObject({ x: 10 + 190 / 3, y: 10 + 277 / 8 });
    const ultima = hojas[0]![23]!;
    expect(ultima.x + ultima.ancho).toBeCloseTo(ANCHO_A4 - 10, 9);
    expect(ultima.y + ultima.alto).toBeCloseTo(ALTO_A4 - 10, 9);
    expect(hojas[1]![0]).toMatchObject({ x: 10, y: 10 });
  });

  it('los formatos de fábrica son válidos', () => {
    for (const { formato } of FORMATOS) expect(validarFormato(formato)).toBeNull();
  });

  it('valida columnas, filas y margen', () => {
    expect(validarFormato({ columnas: 7, filas: 8, margen: 0 })).toBe('Las columnas van de 1 a 6.');
    expect(validarFormato({ columnas: 3, filas: 0, margen: 0 })).toBe('Las filas van de 1 a 20.');
    expect(validarFormato({ columnas: 3, filas: 8, margen: 30 })).toBe('El margen va de 0 a 25 mm.');
  });
});

describe('textos', () => {
  it('precio sin centavos si son cero', () => {
    expect(precioEtiqueta(158_000)).toBe('$ 1.580');
    expect(precioEtiqueta(158_050)).toBe('$ 1.580,50');
    expect(precioEtiqueta(9_00)).toBe('$ 9');
  });

  it('fecha corta', () => {
    expect(fechaEtiqueta(new Date(2026, 9, 2))).toBe('02/10/2026');
  });

  it('parte en renglones y corta con … lo que no entra', () => {
    const medir = (t: string) => t.length; // una letra = 1
    expect(partirEnRenglones('Yerba mate Playadito 1 kg', 12, 2, medir)).toEqual(['Yerba mate', 'Playadito 1…']);
    expect(partirEnRenglones('Yerba 1 kg', 12, 2, medir)).toEqual(['Yerba 1 kg']);
    expect(partirEnRenglones('Supercalifragilístico', 8, 3, medir)).toEqual(['Supercal', 'ifragilí', 'stico']);
  });
});
