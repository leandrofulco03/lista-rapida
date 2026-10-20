import { expect, test } from '@playwright/test';
import { cargarCatalogo, entrarComoDueno, vender } from './ayudas';

test.describe('en la compu', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test('el menú lateral queda fijo a la izquierda y marca la sección actual', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Entrá a Vendia' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: info.outputPath('ingreso-compu.png') });
    await entrarComoDueno(page);
    const menu = page.getByRole('navigation', { name: 'Secciones' });
    await expect(menu).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden();
    await expect(menu.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');

    await cargarCatalogo(page);
    await page.getByRole('button', { name: 'Nueva venta' }).click();
    await vender(page, ['P1', 'P2', 'P3'], 'Efectivo', '$ 3.950,00');
    await vender(page, ['P5'], 'Débito', '$ 7.900,00');
    await expect(menu.getByRole('button', { name: 'Vender' })).toHaveAttribute('aria-current', 'page');
    await page.getByLabel('Buscar producto').fill('P');
    await page.screenshot({ path: info.outputPath('vender-compu.png') });

    await menu.getByRole('button', { name: 'Inicio' }).click();
    await expect(page.getByTestId('inicio-vendido-hoy')).toContainText('$ 11.850,00');
    await expect(page.getByTestId('inicio-ultimas')).toContainText('Fernet Branca 750');
    await page.screenshot({ path: info.outputPath('inicio-compu.png') });

    await menu.getByRole('button', { name: 'Ventas' }).click();
    await expect(page.getByTestId('kpi-venta-total')).toContainText('$ 11.850,00');
    await page.screenshot({ path: info.outputPath('ventas-compu.png'), fullPage: true });

    await menu.getByRole('button', { name: 'Análisis' }).click();
    await expect(page.getByTestId('analisis-ventas')).toContainText('$ 11.850,00');
    await page.screenshot({ path: info.outputPath('analisis-compu.png'), fullPage: true });

    await menu.getByRole('button', { name: 'Catálogo' }).click();
    await expect(page.getByTestId('lista-productos')).toContainText('Yerba Playadito 1 kg');
    await page.screenshot({ path: info.outputPath('catalogo-compu.png'), fullPage: true });
  });
});

test('en el celular el menú se abre con el botón y se cierra con Escape o al elegir una sección', async ({ page }, info) => {
  await entrarComoDueno(page);
  await expect(page.getByTestId('inicio-vendido-hoy')).toContainText('$ 0,00');
  await page.screenshot({ path: info.outputPath('inicio-celular.png'), fullPage: true });
  const menu = page.getByRole('navigation', { name: 'Secciones' });
  const abrir = page.getByRole('button', { name: 'Abrir menú' });
  await expect(menu).toBeHidden();

  await abrir.click();
  await expect(menu).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toBeFocused();
  await page.screenshot({ path: info.outputPath('menu-celular.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(abrir).toBeFocused();

  await abrir.click();
  await menu.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  await expect(menu).toBeHidden();
});
