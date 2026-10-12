import { PDFDocument } from 'pdf-lib';
import { expect, it } from 'vitest';
import { agruparPorRubro } from '../domain/exportar';
import { leerPdf } from '../parsers/pdf';
import { generarListaPreciosPdf } from './listaPreciosPdf';

it('arma la lista agrupada por rubro, en varias hojas numeradas', async () => {
  const productos = Array.from({ length: 120 }, (_, i) => ({
    codigoInterno: `P${i}`,
    descripcion: `Producto número ${String(i).padStart(3, '0')}`,
    rubroId: i < 100 ? 1 : null,
    ivaPct: 2100,
    precioVentaActual: 100_000 + i * 50,
    actualizado: '2026-10-12T15:00:00.000Z',
  }));
  const bytes = await generarListaPreciosPdf(agruparPorRubro(productos, new Map([[1, 'Almacén']])), 'Almacén Don José', '12/10/2026');
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(3);

  const texto = (await leerPdf(bytes.slice())).filas.flat().join(' ');
  expect(texto).toContain('Almacén Don José');
  expect(texto).toContain('Sin rubro');
  expect(texto).toContain('Producto número 000');
  expect(texto).toContain('Producto número 119');
  expect(texto).toContain('$ 1.000,50');
  expect(texto).toContain('Página 3 de 3');
});
