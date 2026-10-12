import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('F12: la copia de seguridad se guarda en un dispositivo y se restaura en otro', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByTestId('recordatorio-respaldo')).toHaveCount(0); // sin datos todavía, no molesta

  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles({
    name: 'catalogo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['Código;Descripción;Precio de venta', 'P1;Yerba Playadito 1 kg;4.500,00', 'P2;Aceite Natura 900 ml;2.300,00'].join('\r\n')),
  });
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  // Con datos y sin ninguna copia, el inicio lo recuerda.
  await expect(page.getByTestId('recordatorio-respaldo')).toContainText('Todavía no guardaste una copia');
  await page.getByRole('button', { name: 'Guardar una copia ahora' }).click();
  await expect(page.getByTestId('ultimo-respaldo')).toHaveText('Todavía no hiciste ninguna copia.');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Guardar copia en un archivo' }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^listamatch-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByTestId('ultimo-respaldo')).toHaveText('La última copia es de hoy.');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByTestId('recordatorio-respaldo')).toHaveCount(0);
  const archivo = await descarga.path();

  // Otro dispositivo: navegador sin datos.
  const otro = await browser.newPage();
  await otro.goto('/');
  await otro.getByRole('button', { name: 'Tengo una copia de seguridad' }).click();
  await otro.getByLabel('Archivo de la copia').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from('{"no":"es"}') });
  await expect(otro.getByRole('alert')).toHaveText('El archivo no es una copia de seguridad de la app.');
  await otro.getByLabel('Archivo de la copia').setInputFiles({ name: descarga.suggestedFilename(), mimeType: 'application/json', buffer: readFileSync(archivo) });
  await expect(otro.getByTestId('confirmar-restaurar')).toContainText('con 2 productos y 0 proveedores');
  await otro.getByRole('button', { name: 'Restaurar esta copia' }).click();

  await expect(otro.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
  await otro.getByRole('button', { name: 'Catálogo' }).click();
  await expect(otro.getByTestId('cantidad-productos')).toHaveText('2 productos');
  await expect(otro.getByTestId('lista-productos')).toContainText('$ 4.500,00');
  await otro.close();
});
