import { expect, test } from '@playwright/test';

test('F01: primera configuración, queda guardada al recargar y se puede editar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lista Rápida' })).toBeVisible();

  // Sin nombre no deja avanzar
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByText('Escribí el nombre de tu comercio.')).toBeVisible();

  // Valores sugeridos: 30% y redondeo a $10 → $ 1.000 + IVA 21% se vende a $ 1.580
  await expect(page.getByLabel('Recargo general')).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'A $10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('ejemplo-precio')).toContainText('$ 1.580,00');

  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Termina en 90' }).click();
  await expect(page.getByTestId('ejemplo-precio')).toContainText('$ 1.590,00');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();

  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();

  await page.getByRole('button', { name: 'Configuración' }).click();
  await expect(page.getByRole('button', { name: 'Termina en 90' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Recargo general').fill('40');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByRole('button', { name: 'Configuración' }).click();
  await expect(page.getByLabel('Recargo general')).toHaveValue('40');
});

test('F01: la app ofrece instalarse (manifest)', async ({ page, request }) => {
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Lista Rápida', lang: 'es-AR', display: 'standalone' });
  expect(manifest.description).toContain('proveedores');
});
