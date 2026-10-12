import { describe, expect, it } from 'vitest';
import { armarFilasPdf } from './pdf';
import type { TextoPdf } from './pdf';

/** Texto de 9 puntos; el ancho se estima en medio punto de letra por carácter. */
const t = (texto: string, x: number, y: number, ancho = texto.length * 4.5): TextoPdf => ({ texto, x, y, ancho, alto: 9 });

/** Precio alineado a la derecha: termina en `derecha`. */
const precio = (texto: string, derecha: number, y: number) => t(texto, derecha - texto.length * 4.5, y);

describe('armarFilasPdf', () => {
  it('arma renglones de arriba hacia abajo y columnas por posición', () => {
    const filas = armarFilasPdf([
      [
        t('A002', 40, 760),
        t('Fideos Matarazzo', 100, 760),
        precio('1.120,50', 540, 760),
        t('Código', 40, 780),
        t('Descripción', 100, 780),
        precio('Precio', 540, 780),
        t('A001', 40, 770),
        t('Yerba', 100, 770),
        precio('13.450,00', 540, 770),
      ],
    ]);
    expect(filas).toEqual([
      ['Código', 'Descripción', 'Precio'],
      ['A001', 'Yerba', '13.450,00'],
      ['A002', 'Fideos Matarazzo', '1.120,50'],
    ]);
  });

  it('une palabras escritas por separado y tolera renglones apenas torcidos', () => {
    const filas = armarFilasPdf([
      [t('A001', 40, 770), t('Yerba', 100, 770.6), t('mate', 125, 770), t('Playadito', 147, 769.7), precio('3.450,00', 540, 770)],
    ]);
    expect(filas).toEqual([['A001', 'Yerba mate Playadito', '3.450,00']]);
  });

  it('un título largo arriba de la tabla no junta las columnas', () => {
    const productos = Array.from({ length: 30 }, (_, i) => [
      t(`A${100 + i}`, 40, 700 - i * 12),
      t('Producto', 100, 700 - i * 12),
      precio('1.000,00', 540, 700 - i * 12),
    ]).flat();
    const filas = armarFilasPdf([
      [t('Lista de precios de octubre - Distribuidora El Sol', 40, 780), t('Pág. 1', 500, 780), ...productos],
    ]);
    expect(filas[0]).toEqual(['Lista de precios de octubre - Distribuidora El Sol', null, 'Pág. 1']);
    expect(filas[1]).toEqual(['A100', 'Producto', '1.000,00']);
  });

  it('sigue en la página siguiente con las mismas columnas', () => {
    const filas = armarFilasPdf([
      [t('A001', 40, 770), t('Yerba', 100, 770), precio('3.450,00', 540, 770)],
      [t('A002', 40, 790), t('Fideos', 100, 790), precio('980,00', 540, 790)],
    ]);
    expect(filas).toEqual([
      ['A001', 'Yerba', '3.450,00'],
      ['A002', 'Fideos', '980,00'],
    ]);
  });

  it('ignora espacios sueltos y devuelve nada si el PDF no tiene texto', () => {
    expect(armarFilasPdf([[{ texto: ' ', x: 40, y: 700, ancho: 30, alto: 0 }], []])).toEqual([]);
  });
});
