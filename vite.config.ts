import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { COLOR_TEMA, DESCRIPCION_APP, NOMBRE_APP, NOMBRE_CORTO } from './src/marca';

export default defineConfig({
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
