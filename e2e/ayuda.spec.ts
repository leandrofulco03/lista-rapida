import { expect, test } from '@playwright/test';

test('Ayuda: se llega desde el inicio, muestra la guía y las preguntas, y lleva a las pantallas', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();

  await page.getByRole('button', { name: '¿Cómo se usa?' }).click();
  await expect(page.getByRole('heading', { name: 'Ayuda', exact: true })).toBeVisible();

  // Arranca en la guía, con los 8 pasos del recorrido en orden.
  await expect(page.getByRole('button', { name: 'Paso a paso' })).toHaveAttribute('aria-pressed', 'true');
  const pasos = page.getByTestId('guia-pasos').getByRole('heading', { level: 2 });
  await expect(pasos).toHaveCount(8);
  await expect(pasos.first()).toHaveText('Paso 1: Configurá tu comercio');
  await expect(pasos.last()).toHaveText('Paso 8: Guardá una copia de seguridad');

  // Las preguntas están plegadas y se abren al tocarlas.
  await page.getByRole('button', { name: 'Preguntas frecuentes' }).click();
  const preguntas = page.getByTestId('preguntas-frecuentes');
  const respuesta = preguntas.getByText('Se guardan sólo en este dispositivo', { exact: false });
  await expect(respuesta).toBeHidden();
  await preguntas.getByText('¿Dónde se guardan mis datos? ¿Alguien más los ve?').click();
  await expect(respuesta).toBeVisible();

  // Un paso de la guía lleva a su pantalla, y de ahí se vuelve al inicio.
  await page.getByRole('button', { name: 'Paso a paso' }).click();
  await page.getByRole('button', { name: 'Ir al Catálogo' }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();

  // Desde la ayuda, "Volver" vuelve al inicio.
  await page.getByRole('button', { name: '¿Cómo se usa?' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
});
