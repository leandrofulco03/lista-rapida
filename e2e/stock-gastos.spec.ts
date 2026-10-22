import { expect, test } from '@playwright/test';
import { cargarCatalogo, entrarComoDueno, irA, vender } from './ayudas';

test('stock: se cuenta, se descuenta al vender, llega mercadería y sugiere qué pedir', async ({ page }) => {
  test.setTimeout(90_000);
  await entrarComoDueno(page);
  await cargarCatalogo(page);

  await irA(page, 'Stock');
  await expect(page.getByText('Todavía no controlás el stock de ningún producto.')).toBeVisible();
  await page.getByRole('button', { name: 'Contar stock' }).click();
  await page.getByLabel('Agregar producto').fill('yerba');
  await page.getByTestId('productos-encontrados').getByRole('button', { name: /Yerba Playadito/ }).click();
  await page.getByLabel('Hay de Yerba Playadito 1 kg').fill('4');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByTestId('aviso-stock')).toHaveText('Listo: se guardó el conteo de 1 producto.');

  // Tres yerbas vendidas: quedan 1.
  await irA(page, 'Vender');
  await vender(page, ['P1', 'P1', 'P1'], 'Efectivo', '$ 4.740,00');
  await irA(page, 'Stock');
  const yerba = page.getByTestId('lista-stock').getByRole('button', { name: /Yerba Playadito/ });
  // 3 vendidas en 28 días: con 1 alcanza para 9 días.
  await expect(yerba).toHaveText(/Alcanza para 9 días1$/);
  await yerba.click();
  await expect(page.getByTestId('lista-stock')).toContainText('Vendido en 4 semanas: 3');

  // Llegaron 12 cocas: empieza a llevar stock.
  await page.getByRole('button', { name: 'Llegó mercadería' }).click();
  await page.getByLabel('Agregar producto').fill('P2');
  await page.getByLabel('Agregar producto').press('Enter');
  await page.getByLabel('Llegaron de Coca Cola 2,25 l').fill('12');
  await page.getByLabel('Nota (opcional)').fill('Remito 55');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByTestId('aviso-stock')).toHaveText('Listo: se sumó lo que llegó de 1 producto.');
  await expect(page.getByTestId('lista-stock').getByRole('button', { name: /Coca Cola/ })).toContainText('12');

  // Para pedir: 3 en 28 días; para 30 días hacen falta 3,2 y hay 1 → pedir 3. Para 7 días alcanza.
  await page.getByRole('button', { name: 'Para pedir' }).click();
  await expect(page.getByTestId('nada-para-pedir')).toBeVisible();
  await page.getByRole('button', { name: '30 días' }).click();
  await expect(page.getByTestId('pedido')).toContainText('Yerba Playadito 1 kg');
  await expect(page.getByTestId('pedido')).toContainText('Pedir 3');
  await expect(page.getByTestId('pedido')).not.toContainText('Coca Cola');
  await expect(page.getByRole('link', { name: 'Mandar por WhatsApp' })).toHaveAttribute('href', /3%20%C3%97%20Yerba/);
});

test('gastos y resultado: ganancia del mes menos gastos fijos', async ({ page }) => {
  await entrarComoDueno(page);
  await cargarCatalogo(page);
  // Costo $ 1.000 + IVA = $ 1.210; se vende a $ 1.580: $ 370 de ganancia cada una.
  await irA(page, 'Vender');
  await vender(page, ['P1', 'P1', 'P1'], 'Efectivo', '$ 4.740,00');

  await irA(page, 'Gastos y resultado');
  await expect(page.getByTestId('resultado-ganancia')).toHaveText('$ 1.110,00');
  await page.getByLabel('Nuevo gasto').fill('Alquiler');
  await page.getByRole('button', { name: 'Agregar' }).click();
  await page.getByLabel('Nuevo gasto').fill('Luz');
  await page.getByRole('button', { name: 'Agregar' }).click();
  await page.getByRole('textbox', { name: 'Alquiler' }).fill('800');
  await page.getByRole('textbox', { name: 'Luz' }).fill('100');
  await page.getByRole('button', { name: 'Guardar gastos del mes' }).click();
  await expect(page.getByTestId('aviso-gastos')).toContainText('guardados');
  await expect(page.getByTestId('resultado-gastos')).toHaveText('−$ 900,00');
  await expect(page.getByTestId('resultado-neto')).toHaveText('$ 210,00');

  // No se puede ir a un mes que no llegó; el mes anterior no tiene ventas ni gastos.
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByTestId('resultado-neto')).toHaveText('$ 0,00');
  await expect(page.getByRole('button', { name: 'Usar los montos del mes anterior' })).toHaveCount(0);
});
