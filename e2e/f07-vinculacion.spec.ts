import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const casos = JSON.parse(readFileSync(fileURLToPath(new URL('../tests/fixtures/vinculacion/casos.json', import.meta.url)), 'utf-8')) as {
  catalogo: string[];
  lineas: { descripcion: string }[];
};

const csv = (nombre: string, filas: string[]) => ({ name: nombre, mimeType: 'text/csv', buffer: Buffer.from(filas.join('\r\n')) });

const CATALOGO = csv('catalogo.csv', ['Código;Descripción;Costo', ...casos.catalogo.map((d, i) => `P${i + 1};${d};1.000,00`)]);
const LISTA = csv('el-sol.csv', ['Cód.;Descripción;Precio s/IVA', ...casos.lineas.map((l, i) => `E${i + 1};${l.descripcion};1.234,50`)]);

async function configurar(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nombre del comercio').fill('Almacén Don José');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
}

async function subirLista(page: Page) {
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Archivo de la lista').setInputFiles(LISTA);
  await page.getByRole('button', { name: 'Leer lista' }).click();
}

test('F07: la primera lista se confirma con un toque y la segunda se vincula sola', async ({ page }) => {
  await configurar(page);

  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.getByLabel('Archivo del catálogo').setInputFiles(CATALOGO);
  await page.getByRole('button', { name: 'Leer archivo' }).click();
  await page.getByRole('button', { name: 'Importar productos' }).click();
  await expect(page.getByTestId('titulo-importacion')).toHaveText('Importamos 30 productos');
  await page.getByRole('button', { name: 'Ver el catálogo' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  // Primera lista: proveedor nuevo.
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Nombre del proveedor').fill('Distribuidora El Sol');
  await page.getByLabel('Archivo de la lista').setInputFiles(LISTA);
  await page.getByRole('button', { name: 'Leer lista' }).click();
  await page.getByRole('button', { name: 'Usar estas columnas' }).click();
  await expect(page.getByTestId('titulo-resultado')).toHaveText('Leímos 40 productos');
  await page.getByRole('button', { name: 'Comparar con mi catálogo' }).click();

  await expect(page.getByTestId('resumen-vinculos')).toHaveText(/0\s*ya vinculados\s*31\s*sugeridos\s*5\s*para elegir\s*4\s*no están/);

  // Una sugerida se rechaza y se elige a mano.
  const coca = page.getByTestId('grupo-sugeridas').getByTestId('linea-vinculo').filter({ hasText: 'Coca Cola 500 cc' });
  await coca.getByRole('button', { name: 'No es este' }).click();
  await coca.getByRole('button', { name: 'Buscar en el catálogo' }).click();
  await coca.getByLabel('Buscar en el catálogo').fill('coca 500');
  await coca.getByRole('button', { name: /Gaseosa Coca-Cola 500 ml/ }).click();
  await expect(coca).toContainText('Va con Gaseosa Coca-Cola 500 ml');

  // Una dudosa: la leche de 500 ml no es la de 1 l; se deja sin vincular. La lavandina de 2 l tampoco.
  const leche = page.getByTestId('grupo-dudosas').getByTestId('linea-vinculo').filter({ hasText: 'Leche La Serenísima entera 500 ml' });
  await expect(leche.getByRole('button', { name: 'Leche La Serenísima entera 1 l' })).toBeVisible();

  await page.getByRole('button', { name: 'Guardar 31 vínculos' }).click();
  await expect(page.getByTestId('titulo-vinculos-guardados')).toHaveText('31 de 40 productos vinculados');
  await page.getByRole('button', { name: 'Listo' }).click();

  // Segunda lista del mismo proveedor: lo confirmado se reconoce solo.
  await subirLista(page);
  await expect(page.getByTestId('aviso-automatico')).toBeVisible();
  await page.getByRole('button', { name: 'Comparar con mi catálogo' }).click();
  await expect(page.getByTestId('resumen-vinculos')).toHaveText(/31\s*ya vinculados\s*0\s*sugeridos\s*5\s*para elegir\s*4\s*no están/);
  await expect(page.getByRole('button', { name: 'Seguir' })).toBeVisible();
});

test('F07: sin catálogo, avisa que hay que cargarlo', async ({ page }) => {
  await configurar(page);
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Nombre del proveedor').fill('Distribuidora El Sol');
  await page.getByLabel('Archivo de la lista').setInputFiles(LISTA);
  await page.getByRole('button', { name: 'Leer lista' }).click();
  await page.getByRole('button', { name: 'Usar estas columnas' }).click();
  await page.getByRole('button', { name: 'Comparar con mi catálogo' }).click();
  await expect(page.getByRole('heading', { name: 'Tu catálogo está vacío' })).toBeVisible();
});
