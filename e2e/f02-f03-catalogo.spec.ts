import { entrarComoDueno } from './ayudas';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const CATALOGO = fileURLToPath(new URL('../tests/fixtures/catalogo/', import.meta.url));

async function configurar(page: Page) {
  await entrarComoDueno(page);
}

test('F02: se crea un proveedor, se edita su ficha y se da de baja', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Proveedores' }).click();
  await page.getByLabel('Proveedor nuevo').fill('Distribuidora El Sol');
  await page.getByRole('button', { name: 'Agregar proveedor' }).click();

  await expect(page.getByRole('heading', { name: 'Distribuidora El Sol' })).toBeVisible();
  await page.getByRole('button', { name: 'Sí, con IVA' }).click();
  await page.getByLabel('Descuentos').fill('10 + 5');
  await expect(page.getByText('en total 14,5%')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page.getByTestId('lista-proveedores')).toContainText('Lista con IVA · Descuento 10 + 5%');

  // Al subir una lista, el proveedor ya trae que su lista es con IVA.
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveValue(/\d+/);
  await expect(page.getByRole('button', { name: 'Sí, con IVA' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Proveedores' }).click();
  await page.getByRole('button', { name: /Distribuidora El Sol/ }).click();
  await page.getByRole('button', { name: 'Dar de baja' }).click();
  await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
  await expect(page.getByText('Todavía no cargaste proveedores')).toBeVisible();
});

test('F03: se importan 500 productos desde Excel y se edita uno', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByTestId('cantidad-productos')).toHaveText('0 productos');

  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles(join(CATALOGO, 'catalogo-500.xlsx'));
  await page.getByRole('button', { name: 'Leer archivo' }).click();

  await expect(page.getByTestId('aviso-mapeo')).toContainText('Encontramos las columnas');
  await expect(page.getByLabel('Columna C')).toHaveValue('rubro');
  await expect(page.getByLabel('Columna E')).toHaveValue('precioVenta');
  await expect(page.getByTestId('resumen-mapeo')).toHaveText('Se leen 500 productos.');
  await page.getByRole('button', { name: 'Importar productos' }).click();

  await expect(page.getByTestId('titulo-importacion')).toHaveText('Importamos 500 productos');
  await expect(page.getByTestId('resumen-importacion')).toContainText('8 rubros nuevos');
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await expect(page.getByTestId('cantidad-productos')).toHaveText('500 productos');

  await page.getByLabel('Buscar producto').fill('#123');
  await expect(page.getByTestId('lista-productos').locator('li')).toHaveCount(1);
  await page.getByTestId('lista-productos').getByRole('button').click();
  await page.getByLabel('Recargo propio').fill('50');
  await page.getByRole('button', { name: 'Usar ese precio' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByTestId('cantidad-productos')).toHaveText('500 productos');
});

test('F03: se carga un producto a mano con el precio sugerido', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Rubros' }).click();
  await page.getByLabel('Nombre del rubro').fill('Almacén');
  await page.getByLabel('Recargo del rubro').fill('40');
  await page.getByRole('button', { name: 'Agregar rubro' }).click();
  await expect(page.getByTestId('lista-rubros')).toContainText('Almacén40%');
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Agregar producto' }).click();
  await expect(page.getByLabel('Código')).toHaveValue('P0001');
  await page.getByLabel('Descripción').fill('Yerba Playadito 1 kg');
  await page.getByLabel('Rubro').selectOption({ label: 'Almacén' });
  await page.getByLabel('Costo').fill('1.000');
  // $ 1.000 + IVA 21% + 40% del rubro = $ 1.694 → a $10: $ 1.700.
  await expect(page.getByTestId('precio-sugerido')).toContainText('$ 1.700,00');
  await page.getByRole('button', { name: 'Usar ese precio' }).click();
  await page.getByRole('button', { name: 'Agregar al catálogo' }).click();

  await expect(page.getByTestId('lista-productos')).toContainText('Yerba Playadito 1 kg');
  await expect(page.getByTestId('lista-productos')).toContainText('P0001 · Almacén');
  await expect(page.getByTestId('lista-productos')).toContainText('$ 1.700,00');
});
