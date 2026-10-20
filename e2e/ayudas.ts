import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Los recorridos corren con la base embebida en el navegador (build con --mode e2e): cada prueba
 * arranca con un navegador limpio, sin cuentas ni comercios.
 */

export const CLAVE = 'clave-de-prueba';

/** Crea una cuenta nueva y queda con la sesión iniciada. */
export async function crearCuenta(page: Page, email: string) {
  await page.getByRole('button', { name: 'No, crear una' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
}

export async function ingresar(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

/** Abre la app, crea la cuenta del dueño y llega a la configuración del comercio nuevo. */
export async function empezarComercio(page: Page, email = 'dueno@almacen.com') {
  await page.goto('/');
  await crearCuenta(page, email);
  await page.getByRole('button', { name: 'Crear mi comercio' }).click();
}

/** Dueño con su comercio creado, en el inicio. */
export async function entrarComoDueno(page: Page, nombre = 'Almacén Don José') {
  await empezarComercio(page);
  await page.getByLabel('Nombre del comercio').fill(nombre);
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible();
}
