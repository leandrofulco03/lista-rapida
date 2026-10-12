import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const LISTAS = fileURLToPath(new URL('../tests/fixtures/sinteticas/', import.meta.url));

async function configurar(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
}

test('F04/F06: la primera lista pide confirmar columnas y la segunda del mismo proveedor se lee sola', async ({ page }) => {
  await configurar(page);

  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveValue('nuevo');
  await page.getByLabel('Nombre del proveedor').fill('Distribuidora El Sol');
  await page.getByLabel('Archivo de la lista').setInputFiles(join(LISTAS, '02-distribuidora-con-logo.xlsx'));
  await page.getByRole('button', { name: 'Leer lista' }).click();

  // Mapeo: encontró los títulos en la fila 6, debajo de los datos del proveedor.
  await expect(page.getByRole('heading', { name: '¿Qué columna es cada dato?' })).toBeVisible();
  await expect(page.getByTestId('aviso-mapeo')).toContainText('Encontramos las columnas');
  await expect(page.getByLabel('Fila con los títulos')).toHaveValue('5');
  await expect(page.getByLabel('Columna A')).toHaveValue('codigo');
  await expect(page.getByLabel('Columna B')).toHaveValue('descripcion');
  await expect(page.getByLabel('Columna D')).toHaveValue('costo');
  await expect(page.getByTestId('resumen-mapeo')).toHaveText('Se leen 40 productos y se saltean 4 filas.');
  await page.getByRole('button', { name: 'Usar estas columnas' }).click();

  await expect(page.getByTestId('titulo-resultado')).toHaveText('Leímos 40 productos');
  await expect(page.getByTestId('lineas-leidas').locator('li').first()).toContainText('Yerba mate Playadito');
  await expect(page.getByTestId('lineas-leidas').locator('li').first()).toContainText('+ IVA');
  await page.getByRole('button', { name: 'Listo' }).click();

  // Segunda lista del mismo proveedor, con filas de más arriba y las columnas en otro orden.
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await expect(page.getByLabel('Proveedor', { exact: true })).not.toHaveValue('nuevo');
  await page.getByLabel('Archivo de la lista').setInputFiles({
    name: 'el-sol-semana-2.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'DISTRIBUIDORA EL SOL S.A.',
        'Lista N° 42',
        '',
        'Descripción;Cód. Art.;Precio s/IVA;Presentación',
        'Yerba mate Playadito;A0001;3.600,00;1 kg',
        'Fideos Matarazzo tirabuzón;A0003;1.190,50;500 g',
      ].join('\r\n'),
    ),
  });
  await page.getByRole('button', { name: 'Leer lista' }).click();

  await expect(page.getByTestId('aviso-automatico')).toContainText('Distribuidora El Sol');
  await expect(page.getByTestId('titulo-resultado')).toHaveText('Leímos 2 productos');
  await expect(page.getByTestId('lineas-leidas')).toContainText('$ 3.600,00');
  await expect(page.getByTestId('lineas-leidas')).toContainText('$ 1.190,50');
});

test('F06: si la app no está segura, se corrigen las columnas a mano', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Nombre del proveedor').fill('Mayorista Norte');
  await page.getByRole('button', { name: 'Sí, con IVA' }).click();
  await page.getByLabel('Archivo de la lista').setInputFiles({
    name: 'norte.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['1001;Aceite Natura girasol;2.890,00;3.468,00', '1002;Arroz Gallo Oro;1.450,00;1.740,00'].join('\n')),
  });
  await page.getByRole('button', { name: 'Leer lista' }).click();

  await expect(page.getByTestId('aviso-mapeo')).toContainText('No estamos seguros');
  await expect(page.getByLabel('Fila con los títulos')).toHaveValue('');
  await expect(page.getByLabel('Columna C')).toHaveValue('costo');
  // El precio que vale es el de la columna D.
  await page.getByLabel('Columna D').selectOption('costo');
  await expect(page.getByLabel('Columna C')).toHaveValue('');
  await page.getByRole('button', { name: 'Usar estas columnas' }).click();

  await expect(page.getByTestId('titulo-resultado')).toHaveText('Leímos 2 productos');
  await expect(page.getByTestId('lineas-leidas')).toContainText('$ 3.468,00');
  await expect(page.getByTestId('lineas-leidas')).toContainText('con IVA');
});

test('F04: un PDF avisa que todavía no se puede leer', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Nombre del proveedor').fill('Proveedor PDF');
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'lista.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.getByRole('button', { name: 'Leer lista' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF todavía no se pueden leer');
});
