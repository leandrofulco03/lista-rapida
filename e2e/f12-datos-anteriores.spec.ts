import { expect, test } from '@playwright/test';
import { entrarComoDueno } from './ayudas';

/** Una copia de seguridad como la guardaba la v1 (ids numéricos, todo en el navegador). */
const copiaV1 = {
  app: 'lista-rapida',
  formato: 1,
  version: 2,
  fecha: '2026-10-12T12:00:00.000Z',
  tablas: {
    config: [{ id: 'comercio', nombreComercio: 'Almacén viejo', recargoGeneral: 3000, redondeo: { tipo: 'multiplo', pesos: 10 }, ventaIncluyeIva: true, ivaDefault: 2100, ultimoRespaldo: null }],
    rubros: [],
    proveedores: [{ id: 1, nombre: 'Distribuidora El Sol', mapeoColumnas: null, listaIncluyeIva: false, descuentosPct: [], creado: '2026-10-01T00:00:00.000Z' }],
    productos: [
      { id: 1, codigoInterno: 'P1', descripcion: 'Yerba Playadito 1 kg', descripcionNormalizada: '', rubroId: null, recargoPct: null, ivaPct: 2100, costoActual: 300_000, precioVentaActual: 450_000, actualizado: '2026-10-10T00:00:00.000Z' },
      { id: 2, codigoInterno: 'P2', descripcion: 'Aceite Natura 900 ml', descripcionNormalizada: '', rubroId: null, recargoPct: null, ivaPct: 2100, costoActual: 150_000, precioVentaActual: 230_000, actualizado: '2026-10-10T00:00:00.000Z' },
    ],
    vinculos: [],
    importaciones: [],
    lineasImportacion: [],
    historialPrecios: [],
  },
};

test('el dueño trae los datos de la versión anterior con su copia de seguridad', async ({ page }) => {
  await entrarComoDueno(page);
  await page.getByRole('button', { name: 'Configuración' }).click();
  await page.getByRole('button', { name: 'Traer datos de la versión anterior' }).click();

  await page.getByLabel('Archivo de la copia').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from('{"no":"es"}') });
  await expect(page.getByRole('alert')).toHaveText('El archivo no es una copia de seguridad de la app.');
  await page.getByLabel('Archivo de la copia').setInputFiles({
    name: 'listamatch-respaldo-2026-10-12.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(copiaV1)),
  });
  await expect(page.getByTestId('confirmar-restaurar')).toContainText('con 2 productos y 1 proveedores');
  await page.getByRole('button', { name: 'Traer estos datos' }).click();

  // Queda en el catálogo, con los productos de la copia y el nombre de ahora.
  await expect(page.getByTestId('cantidad-productos')).toHaveText('2 productos');
  await expect(page.getByTestId('lista-productos')).toContainText('$ 4.500,00');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén Don José' })).toBeVisible();
  await page.getByRole('button', { name: 'Proveedores' }).click();
  await expect(page.getByTestId('lista-proveedores')).toContainText('Distribuidora El Sol');
});
