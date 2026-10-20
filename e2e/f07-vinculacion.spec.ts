import { entrarComoDueno, irA } from './ayudas';
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
  await entrarComoDueno(page);
}

async function subirLista(page: Page) {
  await page.getByRole('button', { name: 'Subí una lista' }).click();
  await page.getByLabel('Archivo de la lista').setInputFiles(LISTA);
  await page.getByRole('button', { name: 'Leer lista' }).click();
}

test('F07: la primera lista se confirma con un toque y la segunda se vincula sola', async ({ page }) => {
  await configurar(page);

  await irA(page, 'Catálogo');
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

  // Las 4 que no están se dan de alta en el catálogo, sin precio todavía; una se deshace y se vuelve a dar de alta sola.
  await page.getByRole('button', { name: 'Dar de alta las 4 que no están' }).click();
  const nuevas = page.getByTestId('grupo-nuevas');
  await nuevas.getByText(/No están en tu catálogo/).click();
  await expect(nuevas.getByText('Alta en tu catálogo como')).toHaveCount(4);
  const primera = nuevas.getByTestId('linea-vinculo').first();
  await primera.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Dar de alta la que no está' })).toBeVisible();
  await primera.getByRole('button', { name: 'Dar de alta' }).click();
  await expect(primera).toContainText('Todavía sin precio');
  await expect(page.getByRole('button', { name: /Dar de alta la/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Guardar 31 vínculos y revisar precios' }).click();
  // Sigue la revisión de precios (F09): todos los costos suben 23,45%, y las 4 dadas de alta llegan sin costo anterior
  // (se aprueban de a una). La yerba de 1 kg viene dos veces en la lista (vale la primera), así que sin vincular
  // quedan las 5 dudosas más la repetida.
  await expect(page.getByTestId('resumen-revision')).toHaveText(/34\s*suben\s*0\s*bajan\s*0\s*sin cambios\s*6\s*sin vincular/);
  await expect(page.getByTestId('cambio').filter({ hasText: 'No tenía costo cargado' })).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Aprobar todo (30)' })).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();

  // Segunda lista del mismo proveedor: lo confirmado se reconoce solo.
  await subirLista(page);
  await expect(page.getByTestId('aviso-automatico')).toBeVisible();
  await page.getByRole('button', { name: 'Comparar con mi catálogo' }).click();
  await expect(page.getByTestId('resumen-vinculos')).toHaveText(/35\s*ya vinculados\s*0\s*sugeridos\s*5\s*para elegir\s*0\s*no están/);
  await expect(page.getByRole('button', { name: 'Revisar precios' })).toBeVisible();
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
