import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { COLOR_TEMA, DESCRIPCION_APP, NOMBRE_APP, NOMBRE_CORTO } from './src/marca';

/**
 * Lee las cabeceras de seguridad de vercel.json (las que pone Vercel) para usarlas también en
 * `vite preview`: así las pruebas e2e corren con la misma política de seguridad que producción.
 * En `vite dev` no se aplican, porque el modo desarrollo necesita scripts en línea.
 */
function cabecerasDeProduccion(): Record<string, string> {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const todas = vercel.headers.find((h) => h.source === '/(.*)');
  return Object.fromEntries((todas?.headers ?? []).map((h) => [h.key, h.value]));
}

export default defineConfig({
  preview: { headers: cabecerasDeProduccion() },
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // La base embebida (sólo en el build de los recorridos e2e) pesa 17 MB: no se guarda para usar sin conexión.
      workbox: { globIgnores: ['**/pglite-*', '**/localNavegador-*'] },
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
