import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { crearCuenta, entrarComoDueno, irA, salir } from './ayudas';

/** Catálogo chico importado desde un CSV. */
async function cargarCatalogo(page: Page) {
  await irA(page, 'Catálogo');
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles({
    name: 'catalogo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      ['Código;Descripción;Precio de venta', 'P1;Yerba Playadito 1 kg;4.500,00', 'P2;Coca Cola 2,25 l;3.000,00', 'P3;Queso cremoso por kg;12.000,00'].join('\r\n'),
    ),
  });
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
}

test('el dueño vende, ve el resumen del día, carga el total de ayer y anula una venta', async ({ page }) => {
  await entrarComoDueno(page);
  await cargarCatalogo(page);

  await page.getByRole('button', { name: 'Nueva venta' }).click();
  // Buscar por nombre y tocar el resultado.
  await page.getByLabel('Buscar producto').fill('yerba');
  await page.getByTestId('resultados').getByRole('button', { name: /Yerba Playadito/ }).click();
  await page.getByRole('button', { name: 'Uno más de Yerba Playadito 1 kg' }).click();
  // Escribir el código y Enter (como un lector de códigos).
  await page.getByLabel('Buscar producto').fill('P3');
  await page.getByLabel('Buscar producto').press('Enter');
  await page.getByRole('button', { name: 'Cantidad de Queso cremoso por kg' }).click();
  await page.getByRole('textbox', { name: 'Cantidad de Queso cremoso por kg' }).fill('0,25');
  await page.getByRole('textbox', { name: 'Cantidad de Queso cremoso por kg' }).press('Enter');
  // Algo que no está en el catálogo.
  await page.getByRole('button', { name: '+ Varios (importe a mano)' }).click();
  await page.getByLabel('Importe').fill('500');
  await page.getByRole('button', { name: 'Agregar' }).click();
  // 2 × 4.500 + 0,25 × 12.000 + 500
  await expect(page.getByTestId('total-ticket')).toHaveText('$ 12.500,00');

  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Elegí cómo pagó.');
  await page.getByRole('button', { name: 'Mercado Pago / QR' }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Venta guardada: $ 12.500,00.');
  await expect(page.getByTestId('ticket')).toHaveCount(0);

  // Segunda venta, en efectivo.
  await page.getByLabel('Buscar producto').fill('coca');
  await page.getByTestId('resultados').getByRole('button', { name: /Coca Cola/ }).click();
  await page.getByRole('button', { name: 'Efectivo' }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Venta guardada: $ 3.000,00.');
  // Los más vendidos aparecen como botones rápidos al volver a entrar.
  await page.getByRole('button', { name: 'Volver' }).click();

  // Resumen del día.
  await expect(page.getByTestId('periodo')).toHaveText('Hoy');
  await expect(page.getByTestId('kpi-venta-total')).toContainText('$ 15.500,00');
  await expect(page.getByTestId('kpi-tickets')).toContainText('2');
  await expect(page.getByTestId('kpi-ticket-promedio')).toContainText('$ 7.750,00');
  await expect(page.getByTestId('kpi-articulos')).toContainText('4,25');
  await expect(page.getByTestId('por-medio')).toContainText('Mercado Pago / QR');

  // Total del día de ayer, sin detalle.
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await expect(page.getByTestId('periodo')).toHaveText('Ayer');
  await page.getByRole('button', { name: 'Total del día' }).click();
  await page.getByRole('textbox', { name: 'Efectivo' }).fill('20.000');
  await page.getByRole('textbox', { name: 'Débito' }).fill('5.000');
  await expect(page.getByTestId('total-sin-detalle')).toHaveText('Total $ 25.000,00');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Semana' }).click();
  // La semana incluye hoy; ayer puede ser de la semana anterior si hoy es lunes.
  await expect(page.getByTestId('kpi-venta-total')).toContainText('$');

  // Anular la venta de la coca desde las ventas del día.
  await page.getByRole('button', { name: 'Día' }).click();
  await page.getByRole('button', { name: 'Ver ventas' }).click();
  await expect(page.getByTestId('total-dia')).toHaveText('$ 15.500,00');
  await page.getByTestId('tickets').getByRole('button', { name: /\$ 3\.000,00/ }).click();
  await page.getByRole('button', { name: 'Anular venta' }).click();
  await page.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(page.getByTestId('total-dia')).toHaveText('$ 12.500,00');
  await expect(page.getByTestId('tickets')).toContainText('Anulada');
});

test('el empleado vende y ve sólo sus ventas de hoy', async ({ page }) => {
  await entrarComoDueno(page);
  await cargarCatalogo(page);
  await irA(page, 'Equipo');
  await page.getByRole('button', { name: 'Generar código' }).click();
  const codigo = (await page.getByTestId('codigo-invitacion').textContent())!;
  await page.getByRole('button', { name: 'Volver' }).click();
  // Una venta del dueño, que el empleado no tiene que ver.
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await page.getByLabel('Buscar producto').fill('P2');
  await page.getByLabel('Buscar producto').press('Enter');
  await page.getByRole('button', { name: 'Débito' }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toContainText('Venta guardada');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await salir(page);

  await crearCuenta(page, 'juan@almacen.com');
  await page.getByRole('button', { name: 'Tengo un código' }).click();
  await page.getByLabel('Código').fill(codigo);
  await page.getByLabel('Tu nombre').fill('Juan');
  await page.getByRole('button', { name: 'Unirme' }).click();

  await page.getByRole('button', { name: 'Nueva venta' }).click();
  // El dueño vendió la coca: es el botón rápido de los más vendidos.
  await page.getByRole('region', { name: 'Más vendidos' }).getByRole('button', { name: /Coca Cola/ }).click();
  await page.getByRole('button', { name: 'Uno más de Coca Cola 2,25 l' }).click();
  await page.getByRole('button', { name: 'Efectivo' }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Venta guardada: $ 6.000,00.');

  await page.getByRole('button', { name: 'Ventas de hoy' }).click();
  await expect(page.getByRole('heading', { name: 'Mis ventas de hoy' })).toBeVisible();
  await expect(page.getByTestId('total-dia')).toHaveText('$ 6.000,00');
  await page.getByTestId('tickets').getByRole('button', { name: /\$ 6\.000,00/ }).click();
  await expect(page.getByTestId('tickets')).toContainText('2 × Coca Cola 2,25 l');
  await page.getByRole('button', { name: 'Anular venta' }).click();
  await page.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(page.getByTestId('total-dia')).toHaveText('$ 0,00');
});
