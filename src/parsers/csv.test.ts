import { describe, expect, it } from 'vitest';
import { decodificarTexto, detectarSeparador, leerCsv, separarCsv } from './csv';

const bytes = (texto: string) => new TextEncoder().encode(texto);

describe('decodificarTexto', () => {
  it('lee UTF-8 y saca la marca BOM', () => {
    expect(decodificarTexto(bytes('﻿Azúcar'))).toBe('Azúcar');
  });

  it('si no es UTF-8 lo lee como Windows-1252 (CSV de Excel en Windows)', () => {
    // "Azúcar ñandú" en Latin-1
    const latin1 = new Uint8Array([0x41, 0x7a, 0xfa, 0x63, 0x61, 0x72, 0x20, 0xf1, 0x61, 0x6e, 0x64, 0xfa]);
    expect(decodificarTexto(latin1)).toBe('Azúcar ñandú');
  });
});

describe('detectarSeparador', () => {
  it.each([
    ['Código;Descripción;Precio\n1;Yerba;1.234,50\n2;Té;850', ';'],
    ['codigo,descripcion,precio\n1,Yerba,1234.50\n2,Té,850', ','],
    ['codigo\tdescripcion\tprecio\n1\tYerba\t1234,50', '\t'],
    // La coma decimal no confunde: el `;` aparece igual en todas las líneas.
    ['Descripción;Precio\nYerba;1.234,50\nTé;850,00\nMate;99', ';'],
  ])('%#', (texto, separador) => {
    expect(detectarSeparador(texto)).toBe(separador);
  });
});

describe('separarCsv', () => {
  it('respeta comillas, comillas dobles, saltos de línea y celdas vacías', () => {
    const texto = 'a;"Yerba ""La Merced""";"1.234,50"\r\nb;"Dice\nvarias";\r\n\r\n;;\nc';
    expect(separarCsv(texto, ';')).toEqual([
      ['a', 'Yerba "La Merced"', '1.234,50'],
      ['b', 'Dice\nvarias', null],
      [],
      [],
      ['c'],
    ]);
  });
});

describe('leerCsv', () => {
  it('devuelve las filas sin hoja', () => {
    expect(leerCsv(bytes('Descripción;Precio\nYerba;1.234,50\n'))).toEqual({
      filas: [
        ['Descripción', 'Precio'],
        ['Yerba', '1.234,50'],
      ],
      hoja: null,
    });
  });
});
