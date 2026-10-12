import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('F11: lista de precios en PDF y CSV para la caja que se abre bien en Excel', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles({
    name: 'catalogo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Código;Descripción;Rubro;Precio de venta',
        'P1;Té Taragüí x 50 saquitos;Almacén;1.580,00',
        'P2;Lavandina Ayudín 1 l;Limpieza;990,50',
        'P3;Pilas AA;;0',
      ].join('\r\n'),
    ),
  });
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Lista de precios' }).click();
  await expect(page.getByRole('button', { name: 'Todos (2)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 producto sin precio no se incluye.')).toBeVisible();

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bajar CSV para la caja' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^precios-para-la-caja-\d{4}-\d{2}-\d{2}\.csv$/);
  const contenido = readFileSync(await csv.path());
  expect([...contenido.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM: Excel lee los acentos
  const lineas = contenido.toString('utf-8').slice(1).split('\r\n');
  expect(lineas[0]).toBe('Código;Descripción;Rubro;Precio;IVA %;Actualizado');
  expect(lineas[1]).toMatch(/^P1;Té Taragüí x 50 saquitos;Almacén;1580,00;21;\d{2}\/\d{2}\/\d{4}$/);
  expect(lineas[2]).toMatch(/^P2;Lavandina Ayudín 1 l;Limpieza;990,50;21;/);
  expect(lineas).toHaveLength(4); // encabezado, 2 productos y el renglón vacío del final

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bajar lista en PDF' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^lista-de-precios-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect((await PDFDocument.load(readFileSync(await pdf.path()))).getPageCount()).toBe(1);

  // Sin listas revisadas, "los de la última lista" no tiene nada para bajar.
  await page.getByRole('button', { name: 'Los de la última lista (0)' }).click();
  await expect(page.getByRole('button', { name: 'Bajar lista en PDF' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bajar CSV para la caja' })).toBeDisabled();
});
