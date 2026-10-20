import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    setupFiles: ['src/parsers/pdf.setup.ts'],
    // Las pruebas de la base (Postgres embebido) cargan la máquina; con 5 s, las de PDF a veces no llegan.
    testTimeout: 30_000,
  },
});
