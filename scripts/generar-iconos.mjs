// Genera los íconos PNG de la PWA a partir del logo (V crema sobre verde). Uso: node scripts/generar-iconos.mjs
import { chromium } from '@playwright/test';

const logo = (lado, margen, radio) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${lado}" height="${lado}">
  <rect width="64" height="64" rx="${radio}" fill="#31493c"/>
  <g transform="translate(32 32) scale(${margen}) translate(-32 -32)">
    <path d="M19 21 32 44 45 21" fill="none" stroke="#fffff8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`;

const iconos = [
  { archivo: 'icono-180.png', lado: 180, margen: 1, radio: 0 },
  { archivo: 'icono-192.png', lado: 192, margen: 1, radio: 16 },
  { archivo: 'icono-512.png', lado: 512, margen: 1, radio: 16 },
  // "maskable": el sistema recorta los bordes, así que la V va más chica, dentro de la zona segura.
  { archivo: 'icono-maskable-512.png', lado: 512, margen: 0.75, radio: 0 },
];

const navegador = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const pagina = await navegador.newPage();
for (const i of iconos) {
  await pagina.setViewportSize({ width: i.lado, height: i.lado });
  await pagina.setContent(`<body style="margin:0;background:transparent">${logo(i.lado, i.margen, i.radio)}</body>`);
  await pagina.locator('svg').screenshot({ path: `public/${i.archivo}`, omitBackground: true });
}
await navegador.close();
