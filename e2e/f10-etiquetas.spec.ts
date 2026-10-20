import { entrarComoDueno, irA } from './ayudas';
import { expect, test } from '@playwright/test';

test('F10: etiquetas elegidas del catálogo, con medidas a mano que se recuerdan', async ({ page }) => {
  await entrarComoDueno(page);
  await irA(page, 'Catálogo');
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles({
    name: 'catalogo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['Código;Descripción;Precio de venta', 'P1;Yerba Playadito 1 kg;4.500,00', 'P2;Aceite Natura 900 ml;2.300,50'].join('\r\n')),
  });
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await irA(page, 'Etiquetas');
  await expect(page.getByRole('heading', { name: 'Productos (0)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bajar PDF/ })).toBeDisabled();
  await page.getByLabel('Agregar del catálogo').fill('aceite');
  await page.getByRole('button', { name: /Aceite Natura 900 ml/ }).click();
  await expect(page.getByTestId('productos-etiquetas')).toContainText('$ 2.300,50');

  await page.getByText('Medidas a mano').click();
  await page.getByLabel('Columnas').fill('2');
  await page.getByLabel('Filas').fill('4');
  await page.getByLabel('Margen (mm)').fill('0');
  await expect(page.getByTestId('medida-etiqueta')).toHaveText('Cada etiqueta mide 105 × 74,3 mm.');
  await page.getByLabel('Columnas').fill('9');
  await expect(page.getByRole('alert')).toHaveText('Las columnas van de 1 a 6.');
  await page.getByLabel('Columnas').fill('2');

  await page.getByRole('button', { name: 'Volver' }).click();
  await irA(page, 'Etiquetas');
  await page.getByText('Medidas a mano').click();
  await expect(page.getByLabel('Filas')).toHaveValue('4');
});
