import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { crearCuenta, entrarComoDueno, ingresar, irA, salir } from './ayudas';

/** Un ticket con un importe a mano ("Varios") y el medio de pago elegido. */
async function venderVarios(page: Page, importe: string, medio: string) {
  await page.getByRole('button', { name: '+ Varios (importe a mano)' }).click();
  await page.getByLabel('Importe').fill(importe);
  await page.getByRole('button', { name: 'Agregar' }).click();
  await page.getByRole('button', { name: medio, exact: true }).click();
}

test('el empleado abre la caja, fía a un cliente nuevo y cierra a ciegas; el dueño cobra el fiado y ve la diferencia', async ({ page }) => {
  // Recorrido largo, con dos usuarios.
  test.setTimeout(90_000);
  await entrarComoDueno(page);
  await irA(page, 'Equipo');
  await page.getByRole('button', { name: 'Generar código' }).click();
  const codigo = (await page.getByTestId('codigo-invitacion').textContent())!;
  await salir(page);

  await crearCuenta(page, 'juan@almacen.com');
  await page.getByRole('button', { name: 'Tengo un código' }).click();
  await page.getByLabel('Código').fill(codigo);
  await page.getByLabel('Tu nombre').fill('Juan');
  await page.getByRole('button', { name: 'Unirme' }).click();

  // Abre la caja con el cambio.
  await page.getByRole('button', { name: 'Caja', exact: true }).click();
  await page.getByLabel('¿Con cuánto efectivo empieza la caja?').fill('10.000');
  await page.getByRole('button', { name: 'Abrir caja' }).click();
  await expect(page.getByTestId('aviso-caja')).toHaveText('Caja abierta con $ 10.000,00.');

  // Fiado a un cliente nuevo: hace falta elegirlo antes de cobrar.
  await irA(page, 'Vender');
  await venderVarios(page, '1.500', 'Fiado');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Elegí a quién se le fía.');
  await page.getByLabel('¿A quién se le fía?').fill('Doña Rosa');
  await page.getByRole('button', { name: '+ Cliente nuevo: “Doña Rosa”' }).click();
  await expect(page.getByTestId('cliente-elegido')).toContainText('Doña Rosa');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Fiado a Doña Rosa: $ 1.500,00.');

  // La segunda vez, el cliente ya está en la lista.
  await venderVarios(page, '700', 'Fiado');
  await page.getByLabel('¿A quién se le fía?').fill('rosa');
  await page.getByTestId('clientes-encontrados').getByRole('button', { name: 'Doña Rosa', exact: true }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Fiado a Doña Rosa: $ 700,00.');

  await venderVarios(page, '3.000', 'Efectivo');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Venta guardada: $ 3.000,00.');

  await page.getByRole('button', { name: 'Ventas de hoy' }).click();
  await expect(page.getByTestId('tickets')).toContainText('Fiado a Doña Rosa');

  // Una salida de plata y el cierre, sin ver lo que debería haber.
  await irA(page, 'Caja');
  await page.getByRole('button', { name: '+ Anotar salida o entrada de plata' }).click();
  await page.getByLabel('Importe').fill('2.000');
  await page.getByLabel('Motivo').fill('Pago al de la soda');
  await page.getByRole('button', { name: 'Anotar' }).click();
  await expect(page.getByTestId('movimientos-caja')).toContainText('Pago al de la soda');
  await expect(page.getByTestId('esperado')).toHaveCount(0);
  await page.getByLabel('Contá el efectivo: ¿cuánto hay?').fill('10.500');
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  await expect(page.getByTestId('contado')).toHaveText('$ 10.500,00');
  await expect(page.getByText('El dueño ve si la caja cerró bien.')).toBeVisible();
  await expect(page.getByTestId('diferencia')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar caja' })).toHaveCount(0);
  await salir(page);

  // El dueño: 10.000 + 3.000 en efectivo − 2.000 de la soda = 11.000; se contaron 10.500.
  await ingresar(page, 'dueno@almacen.com');
  await irA(page, 'Caja');
  await expect(page.getByTestId('debe-haber')).toHaveText('$ 11.000,00');
  await expect(page.getByTestId('diferencia')).toHaveText('Faltan $ 500,00');
  await expect(page.getByTestId('historial-caja')).toContainText('Faltan $ 500,00');

  // Clientes: Doña Rosa debe 2.200 y paga 1.000 en efectivo.
  await irA(page, 'Clientes');
  await expect(page.getByTestId('total-fiado')).toContainText('$ 2.200,00');
  await page.getByTestId('clientes').getByRole('button', { name: /Doña Rosa/ }).click();
  await expect(page.getByTestId('saldo-cliente')).toHaveText('$ 2.200,00');
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await page.getByLabel('¿Cuánto pagó?').fill('1.000');
  await page.getByRole('button', { name: 'Guardar pago' }).click();
  await expect(page.getByText('Pago de $ 1.000,00 guardado. Debe $ 1.200,00.')).toBeVisible();
  await expect(page.getByTestId('saldo-cliente')).toHaveText('$ 1.200,00');
  await expect(page.getByTestId('movimientos-cliente').getByRole('listitem')).toHaveCount(3);

  // Con deuda no se archiva.
  await page.getByRole('button', { name: 'Archivar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Tiene deuda: cobrala antes de archivarlo.');

  // El pago en efectivo suma a lo que debería haber en la caja de hoy.
  await irA(page, 'Caja');
  await expect(page.getByTestId('debe-haber')).toHaveText('$ 12.000,00');
  await expect(page.getByTestId('diferencia')).toHaveText('Faltan $ 1.500,00');
});

test('el dueño da de alta un cliente con límite y la venta que lo pasa avisa', async ({ page }) => {
  await entrarComoDueno(page);
  await irA(page, 'Clientes');
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await page.getByLabel('Nombre').fill('Pepe Gómez');
  await page.getByLabel('Celular (opcional)').fill('11 5555 1234');
  await page.getByLabel('Límite de fiado (opcional)').fill('1.000');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Pepe Gómez' })).toBeVisible();
  await expect(page.getByText('Límite: $ 1.000,00')).toBeVisible();

  await irA(page, 'Vender');
  await venderVarios(page, '1.200', 'Fiado');
  await page.getByLabel('¿A quién se le fía?').fill('pepe');
  await page.getByTestId('clientes-encontrados').getByRole('button', { name: 'Pepe Gómez' }).click();
  await expect(page.getByTestId('aviso-limite')).toContainText('le quedan $ 1.000,00');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toHaveText('Fiado a Pepe Gómez: $ 1.200,00.');

  await irA(page, 'Clientes');
  await expect(page.getByTestId('clientes')).toContainText('Pasó su límite');
  await page.getByTestId('clientes').getByRole('button', { name: /Pepe Gómez/ }).click();
  const whatsapp = page.getByRole('link', { name: 'Recordar por WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5491155551234\?text=/);
});
