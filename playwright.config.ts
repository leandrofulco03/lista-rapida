import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    // Permite usar un Chromium ya instalado en vez del que descarga Playwright.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  // Build con la base embebida en el navegador (.env.e2e): cada prueba arranca sin cuentas ni datos.
  webServer: {
    command: 'npm run build:e2e && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
