import { empezarComercio, irA } from './ayudas';
import { expect, test } from '@playwright/test';

test('F01: primera configuración, queda guardada al recargar y se puede editar', async ({ page }) => {
  await empezarComercio(page);
  await expect(page.getByRole('heading', { name: 'Creá tu comercio' })).toBeVisible();

  // Sin nombre no deja avanzar
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByText('Escribí el nombre de tu comercio.')).toBeVisible();

  // Valores sugeridos: 30% y redondeo a $10 → $ 1.000 + IVA 21% se vende a $ 1.580
  await expect(page.getByLabel('Recargo general')).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'A $10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const pasos = page.getByTestId('ejemplo-paso');
  await expect(pasos).toHaveText([
    'Costo $ 1.000,00',
    '+ IVA 21%: $ 210,00 → $ 1.210,00',
    '+ Recargo 30%: $ 363,00 → $ 1.573,00',
    '+ Redondeo (a $10): $ 7,00 → $ 1.580,00',
  ]);
  await expect(page.getByTestId('ejemplo-precio-final')).toHaveText('$ 1.580,00');

  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Termina en 90' }).click();
  await expect(pasos.nth(3)).toHaveText('+ Redondeo (termina en 90): $ 17,00 → $ 1.590,00');
  await expect(page.getByTestId('ejemplo-precio-final')).toHaveText('$ 1.590,00');

  // Reactivo al recargo y al IVA
  await page.getByLabel('Recargo general').fill('40');
  await expect(pasos.nth(2)).toHaveText('+ Recargo 40%: $ 484,00 → $ 1.694,00');
  await page.getByText('Opciones avanzadas').click();
  await page.getByRole('button', { name: '10,5%' }).click();
  await expect(pasos.nth(1)).toHaveText('+ IVA 10,5%: $ 105,00 → $ 1.105,00');
  await page.getByLabel('Recargo general').fill('30');
  await page.getByRole('button', { name: '21%' }).click();
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();

  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();

  await irA(page, 'Configuración');
  await expect(page.getByRole('button', { name: 'Termina en 90' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Recargo general').fill('40');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await irA(page, 'Configuración');
  await expect(page.getByLabel('Recargo general')).toHaveValue('40');
});

test('F01: la app ofrece instalarse (manifest)', async ({ page, request }) => {
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Vendia', lang: 'es-AR', display: 'standalone' });
  expect(manifest.description).toContain('proveedores');
});
