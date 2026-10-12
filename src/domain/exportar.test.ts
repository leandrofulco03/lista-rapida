import { describe, expect, it } from 'vitest';
import { agruparPorRubro, armarCsvCaja, campoCsv, importeCsv } from './exportar';
import type { ProductoExportar } from './exportar';

const p = (codigoInterno: string, descripcion: string, rubroId: number | null, precio: number): ProductoExportar => ({
  codigoInterno,
  descripcion,
  rubroId,
  ivaPct: 2100,
  precioVentaActual: precio,
  actualizado: '2026-10-12T15:00:00.000Z',
});
const rubros = new Map([
  [1, 'Limpieza'],
  [2, 'Almacén'],
]);

describe('agruparPorRubro', () => {
  it('rubros en orden alfabético, sin rubro al final, productos por descripción', () => {
    const grupos = agruparPorRubro(
      [p('3', 'Yerba 1 kg', 2, 1), p('1', 'Lavandina', 1, 1), p('4', 'Pilas', null, 1), p('2', 'Aceite 900 ml', 2, 1), p('5', 'azúcar 1 kg', 2, 1)],
      rubros,
    );
    expect(grupos.map((g) => [g.rubro, g.productos.map((x) => x.descripcion)])).toEqual([
      ['Almacén', ['Aceite 900 ml', 'azúcar 1 kg', 'Yerba 1 kg']],
      ['Limpieza', ['Lavandina']],
      [null, ['Pilas']],
    ]);
  });
});

describe('CSV para la caja', () => {
  it('importe con coma decimal y sin miles', () => {
    expect(importeCsv(158_050)).toBe('1580,50');
    expect(importeCsv(5)).toBe('0,05');
  });

  it('comillas cuando hace falta y nada de fórmulas', () => {
    expect(campoCsv('Yerba')).toBe('Yerba');
    expect(campoCsv('Galletitas "Express"; 3 x 101 g')).toBe('"Galletitas ""Express""; 3 x 101 g"');
    expect(campoCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(campoCsv('-10% promo')).toBe("'-10% promo");
  });

  it('UTF-8 con BOM, punto y coma, CRLF', () => {
    const csv = armarCsvCaja([p('P1', 'Té Taragüí x 50', 2, 158_000), p('P2', 'Lavandina 1 l', 1, 99_050)], rubros);
    expect(csv).toBe(
      '﻿Código;Descripción;Rubro;Precio;IVA %;Actualizado\r\n' +
        'P1;Té Taragüí x 50;Almacén;1580,00;21;12/10/2026\r\n' +
        'P2;Lavandina 1 l;Limpieza;990,50;21;12/10/2026\r\n',
    );
  });
});
