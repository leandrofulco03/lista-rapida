# Lista Rápida

Web instalable (PWA) para que comercios chicos de Argentina actualicen precios a partir de las listas de sus proveedores. La especificación completa vive en el proyecto (spec.md).

## Estado

- Fase 1 (Base): F08 (cálculo de precios) y F01 (configuración inicial) hechos; falta publicar en Cloudflare Pages.
- Fase 2 (Lectura de listas): F04 (Excel/CSV), F05 (PDF con texto) y F06 (mapeo de columnas) hechos y medidos con listas sintéticas; faltan listas reales.

## Comandos

```bash
npm install
npm run dev       # app en modo desarrollo
npm run build     # sitio estático en dist/
npm test          # pruebas unitarias (Vitest)
npm run test:e2e  # recorrido completo (Playwright)
npm run typecheck # chequeo de tipos
```
