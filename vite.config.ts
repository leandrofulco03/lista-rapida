import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { COLOR_TEMA, DESCRIPCION_APP, NOMBRE_APP, NOMBRE_CORTO } from './src/marca';

/**
 * Lee las cabeceras del bloque `/*` de public/_headers (las que pone Cloudflare) para usarlas
 * también en `vite preview`: así las pruebas e2e corren con la misma política de seguridad que producción.
 * En `vite dev` no se aplican, porque el modo desarrollo necesita scripts en línea.
 */
function cabecerasDeProduccion(): Record<string, string> {
  const texto = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');
  const cabeceras: Record<string, string> = {};
  let enTodas = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (linea.trim() === '' || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) {
      enTodas = linea.trim() === '/*';
      continue;
    }
    const dosPuntos = linea.indexOf(':');
    if (enTodas && dosPuntos > 0) cabeceras[linea.slice(0, dosPuntos).trim()] = linea.slice(dosPuntos + 1).trim();
  }
  return cabeceras;
}

export default defineConfig({
  preview: { headers: cabecerasDeProduccion() },
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg', 'icono-180.png'],
      manifest: {
        name: NOMBRE_APP,
        short_name: NOMBRE_CORTO,
        description: DESCRIPCION_APP,
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: COLOR_TEMA,
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
