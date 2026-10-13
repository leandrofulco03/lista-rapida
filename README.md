# ListaMatch

Web instalable (PWA) para que comercios chicos de Argentina actualicen precios a partir de las listas de sus proveedores. La especificación completa vive en el proyecto (spec.md).

## Estado

- Fase 1 (Base): F08 (cálculo de precios) y F01 (configuración inicial) hechos; falta publicar en Cloudflare Pages.
- Fase 2 (Lectura de listas): F04 (Excel/CSV), F05 (PDF con texto) y F06 (mapeo de columnas) hechos y medidos con listas sintéticas; faltan listas reales.
- Fase 3 (Catálogo y vinculación): F02 (proveedores), F03 (catálogo propio) y F07 (vinculación) hechos, con alta en el catálogo de lo que trae la lista y el comercio no tiene; la vinculación está medida sólo con un set sintético.
- Fase 4 (Revisión): F09 (revisión de precios con los controles de seguridad y precio a mano) hecho; falta medir los 5 minutos con una lista real.
- Fase 5 (Salidas y respaldo): F12 (copia de seguridad), F10 (etiquetas) y F11 (lista de precios y CSV) hechos. Las etiquetas falta probarlas en una impresora.
- Fase 6 (Piloto): listas ficticias de un kiosco, una ferretería y un almacén en `tests/fixtures/comercios` (se arman con `python3 scripts/generar-comercios.py`), medidas de punta a punta. Falta publicar y probar con listas reales.

## Comandos

```bash
npm install
npm run dev       # app en modo desarrollo
npm run build     # sitio estático en dist/
npm test          # pruebas unitarias (Vitest)
npm run test:e2e  # recorrido completo (Playwright)
npm run typecheck # chequeo de tipos
```
