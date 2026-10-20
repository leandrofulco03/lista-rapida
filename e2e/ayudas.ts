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

/** Abre el menú lateral si está escondido (en el celular está detrás del botón de arriba). */
async function abrirMenu(page: Page) {
  const boton = page.getByRole('button', { name: 'Abrir menú' });
  // Espera a que la app termine de cargar: o se ve el botón (celular) o el menú (compu).
  await expect(boton.or(page.getByRole('navigation', { name: 'Secciones' })).first()).toBeVisible();
  if (await boton.isVisible()) await boton.click();
}

/** Va a una sección con el menú lateral. */
export async function irA(page: Page, seccion: string) {
  await abrirMenu(page);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: seccion, exact: true }).click();
}

/** Cierra la sesión desde el menú lateral. */
export async function salir(page: Page) {
  await abrirMenu(page);
  await page.getByRole('button', { name: 'Salir' }).click();
}

/** Catálogo con costo y precio: costo $1.000 + IVA → el recargo de 30% da $1.580; uno queda barato a propósito. */
export async function cargarCatalogo(page: Page) {
  await irA(page, 'Catálogo');
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

export async function vender(page: Page, codigos: string[], medio: string, total: string) {
  for (const c of codigos) {
    await page.getByLabel('Buscar producto').fill(c);
    await page.getByLabel('Buscar producto').press('Enter');
  }
  await expect(page.getByTestId('total-ticket')).toHaveText(total);
  await page.getByRole('button', { name: medio, exact: true }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByTestId('aviso-venta')).toContainText('Venta guardada');
}
