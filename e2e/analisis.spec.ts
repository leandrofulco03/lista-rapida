import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { entrarComoDueno } from './ayudas';

/** Catálogo con costo y precio: costo $1.000 + IVA → el recargo de 30% da $1.580; uno queda barato a propósito. */
async function cargarCatalogo(page: Page) {
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles({
    name: 'catalogo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Código;Descripción;Rubro;Costo;Precio de venta',
        'P1;Yerba Playadito 1 kg;Almacén;1.000,00;1.580,00',
        'P2;Coca Cola 2,25 l;Bebidas;1.000,00;1.580,00',
        'P3;Alfajor Jorgito;Golosinas;500,00;790,00',
        'P4;Galletitas Express;Almacén;1.000,00;1.100,00',
        'P5;Fernet Branca 750;Bebidas;5.000,00;7.900,00',
        'P6;Pilas AA;Varios;2.000,00;3.160,00',
      ].join('\r\n'),
    ),
  });
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
}

async function vender(page: Page, codigos: string[], medio: string, total: string) {
  for (const c of codigos) {
    await page.getByLabel('Buscar producto').fill(c);
    await page.getByLabel('Buscar producto').press('Enter');
  }
  await expect(page.getByTestId('total-ticket')).toHaveText(total);
  await page.getByRole('button', { name: medio, exact: true }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toContainText('Venta guardada');
}

test('análisis: ganancia, gráficos, precios para revisar y productos sin movimiento', async ({ page }, info) => {
  await entrarComoDueno(page);
  await cargarCatalogo(page);
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await vender(page, ['P1', 'P1', 'P2', 'P3'], 'Efectivo', '$ 5.530,00');
  await vender(page, ['P1', 'P3', 'P3'], 'Débito', '$ 3.160,00');
  await vender(page, ['P5', 'P2'], 'Mercado Pago / QR', '$ 9.480,00');
  await vender(page, ['P4'], 'Efectivo', '$ 1.100,00');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Análisis' }).click();
  // 3 yerba + 2 coca = 5 × 1.580 = 7.900; 3 alfajores = 2.370; fernet 7.900; galletitas 1.100 → 19.270.
  await expect(page.getByTestId('analisis-ventas')).toContainText('$ 19.270,00');
  // Costo con IVA: 5 × 1.210 + 3 × 605 + 6.050 + 1.210 = 15.125 → ganancia 4.145.
  await expect(page.getByTestId('analisis-ganancia')).toContainText('$ 4.145,00');
  await expect(page.getByTestId('analisis-margen')).toContainText('21,5%');
  await expect(page.getByRole('img', { name: /Ingresos por día/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Leyenda' })).toContainText('Yerba Playadito 1 kg');
  await expect(page.getByRole('table', { name: 'Ventas por día de la semana y hora' })).toBeVisible();
  await expect(page.getByTestId('precios-atrasados')).toContainText('Galletitas Express');
  await expect(page.getByTestId('precios-atrasados')).toContainText('Vendés a pérdida');
  await expect(page.getByTestId('sin-movimiento')).toContainText('Pilas AA');

  await page.getByRole('button', { name: 'Unidades' }).click();
  await expect(page.getByRole('list', { name: 'Leyenda' })).toContainText('u.');
  await page.getByRole('button', { name: '7 días' }).click();
  await expect(page.getByTestId('analisis-ventas')).toContainText('$ 19.270,00');

  await page.screenshot({ path: info.outputPath('analisis.png'), fullPage: true });
});
