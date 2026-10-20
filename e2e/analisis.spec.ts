import { expect, test } from '@playwright/test';
import { cargarCatalogo, entrarComoDueno, irA, vender } from './ayudas';

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

  await irA(page, 'Análisis');
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
