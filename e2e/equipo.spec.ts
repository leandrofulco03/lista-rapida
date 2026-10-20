import { expect, test } from '@playwright/test';
import { crearCuenta, entrarComoDueno, ingresar } from './ayudas';

test('el dueño invita a un empleado con un código; el empleado entra sin ver precios ni costos', async ({ page }) => {
  await entrarComoDueno(page);
  await page.getByRole('button', { name: 'Equipo' }).click();
  await expect(page.getByTestId('miembros')).toContainText('Dueño · Vos');
  await page.getByRole('button', { name: 'Generar código' }).click();
  const codigo = (await page.getByTestId('codigo-invitacion').textContent())!;
  expect(codigo).toMatch(/^[0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4}$/);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Salir' }).click();

  // El empleado crea su cuenta en el mismo dispositivo y entra con el código.
  await crearCuenta(page, 'juan@almacen.com');
  await page.getByRole('button', { name: 'Tengo un código' }).click();
  await page.getByLabel('Código').fill('AAAA BBBB CCCC');
  await page.getByLabel('Tu nombre').fill('Juan');
  await page.getByRole('button', { name: 'Unirme' }).click();
  await expect(page.getByRole('alert')).toContainText('no es válido o ya venció');
  await page.getByLabel('Código').fill(codigo);
  await page.getByRole('button', { name: 'Unirme' }).click();

  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mis ventas de hoy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Catálogo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Proveedores' })).toHaveCount(0);

  // Al volver a abrir la app sigue adentro.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mis ventas de hoy' })).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();

  // El dueño lo ve en el equipo y lo puede quitar.
  await ingresar(page, 'dueno@almacen.com');
  await page.getByRole('button', { name: 'Equipo' }).click();
  await expect(page.getByTestId('miembros')).toContainText('Juan');
  await expect(page.getByTestId('miembros')).toContainText('Empleado · juan@almacen.com');
  await page.getByRole('button', { name: 'Quitar' }).click();
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.getByTestId('miembros')).not.toContainText('Juan');
});

test('una contraseña equivocada no entra', async ({ page }) => {
  await entrarComoDueno(page);
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.getByLabel('Email').fill('dueno@almacen.com');
  await page.getByLabel('Contraseña').fill('otra-clave');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('El email o la contraseña no son correctos.');
});
