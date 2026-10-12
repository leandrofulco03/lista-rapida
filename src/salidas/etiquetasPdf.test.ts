import { PDFDocument } from 'pdf-lib';
import { expect, it } from 'vitest';
import { generarEtiquetasPdf, textoParaPdf } from './etiquetasPdf';
import { leerPdf } from '../parsers/pdf';

it('arma hojas A4 en tamaño real con descripción, precio y fecha', async () => {
  const etiquetas = Array.from({ length: 30 }, (_, i) => ({ descripcion: `Yerba mate Playadito ${i + 1} kg — “suave”`, precio: 158_000 + i }));
  const bytes = await generarEtiquetasPdf(etiquetas, { columnas: 3, filas: 8, margen: 10 }, '12/10/2026');
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  const { width, height } = pdf.getPage(0).getSize();
  expect(width).toBeCloseTo((210 / 25.4) * 72, 3);
  expect(height).toBeCloseTo((297 / 25.4) * 72, 3);

  const tabla = await leerPdf(bytes.slice());
  const texto = tabla.filas.flat().join(' ');
  expect(texto).toContain('Yerba mate Playadito 1 kg');
  expect(texto).toContain('$ 1.580');
  expect(texto).toContain('$ 1.580,29');
  expect(texto).toContain('12/10/2026');
});

it('cambia o saca los caracteres que la fuente del PDF no tiene', () => {
  expect(textoParaPdf('Café “La Virginia” — 250 g ñandú ✓')).toBe('Café "La Virginia" - 250 g ñandú');
});
