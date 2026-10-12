import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import type { Page } from '@playwright/test';

const csv = (nombre: string, filas: string[]) => ({ name: nombre, mimeType: 'text/csv', buffer: Buffer.from(filas.join('\r\n')) });

async function configurar(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
}

test('F09/F10: se revisan los precios con los controles de seguridad, se guardan y se imprimen sus etiquetas', async ({ page }) => {
  await configurar(page); // recargo 30%, redondeo a $10, venta con IVA

  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles(
    csv('catalogo.csv', [
      'Código;Descripción;Costo',
      'P1;Yerba Playadito 1 kg;1.000,00',
      'P2;Fideos Matarazzo 500 g;1.000,00',
      'P3;Aceite Natura 900 ml;1.000,00',
      'P4;Azúcar Ledesma 1 kg;1.000,00',
    ]),
  );
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Nombre del proveedor').fill('Distribuidora El Sol');
  await page.getByLabel('Archivo de la lista').setInputFiles(
    csv('el-sol.csv', [
      'Cód.;Descripción;Precio s/IVA',
      'E1;YERBA PLAYADITO 1 KG;1.050,00',
      'E2;FIDEOS MATARAZZO 500 GRS;1.200,00',
      'E3;ACEITE NATURA 900 CC;2.000,00',
      'E4;AZUCAR LEDESMA 1 KG;900,00',
    ]),
  );
  await page.getByRole('button', { name: 'Leer lista' }).click();
  await page.getByRole('button', { name: 'Usar estas columnas' }).click();
  await page.getByRole('button', { name: 'Comparar con mi catálogo' }).click();
  await page.getByRole('button', { name: 'Guardar 4 vínculos y revisar precios' }).click();

  await expect(page.getByTestId('resumen-revision')).toHaveText(/3\s*suben\s*1\s*bajan\s*0\s*sin cambios\s*0\s*sin vincular/);
  // Ordenados por variación: el +100% arriba, fuera de "aprobar todo".
  const tarjetas = page.getByTestId('cambio');
  await expect(tarjetas.nth(0)).toContainText('Aceite Natura 900 ml');
  await expect(tarjetas.nth(0)).toContainText('+100%');
  await expect(tarjetas.nth(0)).toContainText('Cambia más del 50%');
  await expect(tarjetas.nth(1)).toContainText('+20%');
  await expect(tarjetas.nth(2)).toContainText('−10%');
  await expect(tarjetas.nth(2)).toContainText('Bajó el costo');

  await page.getByRole('button', { name: 'Aprobar todo (3)' }).click();
  await expect(tarjetas.nth(0)).not.toContainText('Queda en');
  await expect(page.getByRole('button', { name: 'Guardar 3 precios' })).toBeVisible();

  // La baja: mejor mantener el precio de hoy.
  await tarjetas.nth(2).getByRole('button', { name: 'Deshacer' }).click();
  await tarjetas.nth(2).getByRole('button', { name: /Mantener/ }).click();
  // La de +100% se aprueba aparte: 2000 · 1,21 · 1,30 = 3146 → $3150.
  await tarjetas.nth(0).getByRole('button', { name: 'Pasar a $ 3.150,00' }).click();

  await page.getByRole('button', { name: 'Guardar 4 precios' }).click();
  await expect(page.getByTestId('titulo-precios-guardados')).toHaveText('Actualizamos 4 precios');

  // F10: etiquetas de lo que cambió.
  await page.getByRole('button', { name: 'Imprimir sus 4 etiquetas' }).click();
  await expect(page.getByRole('heading', { name: 'Productos (4)' })).toBeVisible();
  await expect(page.getByTestId('productos-etiquetas')).toContainText('Aceite Natura 900 ml$ 3.150');
  await page.getByRole('button', { name: '40 por hoja (4 × 10)' }).click();
  await expect(page.getByTestId('medida-etiqueta')).toHaveText('Cada etiqueta mide 47,5 × 27,7 mm.');
  await page.getByRole('button', { name: 'Sacar Yerba Playadito 1 kg' }).click();
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bajar PDF (3 etiquetas, 1 hoja)' }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^etiquetas-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = await PDFDocument.load(readFileSync(await descarga.path()));
  expect(pdf.getPageCount()).toBe(1);
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Catálogo' }).click();
  const productos = page.getByTestId('lista-productos');
  await expect(productos.getByRole('button', { name: /Aceite Natura/ })).toContainText('$ 3.150,00');
  // 1000 · 1,21 · 1,30 = 1573 → $1580, el precio que tenía el azúcar y se mantuvo.
  await expect(productos.getByRole('button', { name: /Azúcar Ledesma/ })).toContainText('$ 1.580,00');
});
