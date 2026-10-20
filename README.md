# ListaMatch

Web instalable (PWA) para almacenes y kioscos de Argentina: ventas del día, precios actualizados desde las listas de los proveedores y análisis. La especificación de la v1 vive en el proyecto (spec.md); el rumbo de la v2 está en DECISIONS.md (20/10/2026).

## Estado

- Fase 1 (Base): F08 (cálculo de precios) y F01 (configuración inicial) hechos; publicada en Cloudflare (Workers con archivos estáticos) en https://lista-match.leandro-fulco.workers.dev/ (acceso público).
- Fase 2 (Lectura de listas): F04 (Excel/CSV), F05 (PDF con texto) y F06 (mapeo de columnas) hechos y medidos con listas sintéticas; faltan listas reales.
- Fase 3 (Catálogo y vinculación): F02 (proveedores), F03 (catálogo propio) y F07 (vinculación) hechos, con alta en el catálogo de lo que trae la lista y el comercio no tiene; la vinculación está medida sólo con un set sintético.
- Fase 4 (Revisión): F09 (revisión de precios con los controles de seguridad y precio a mano) hecho; falta medir los 5 minutos con una lista real.
- Fase 5 (Salidas y respaldo): F12 (copia de seguridad), F10 (etiquetas) y F11 (lista de precios y CSV) hechos. Las etiquetas falta probarlas en una impresora.
- **v2 · Fase 7 (Base en la nube), hecha:** datos en Supabase con roles (dueño y empleado), cuentas con email, equipo con códigos de invitación y "Traer datos de la versión anterior". Publicada en Vercel.
- **v2 · Fase 8 (Ventas), hecha:** carga por ticket o total del día, medios de pago, ventas sin conexión, anulación y resumen con KPIs.
- **v2 · Fase 9 (Análisis), en curso:** ganancia y margen, ingresos por día, más vendidos, rubros, mapa de día y hora, precios para revisar y productos sin movimiento.
- Fase 6 (Piloto): listas ficticias de un kiosco, una ferretería y un almacén en `tests/fixtures/comercios` (se arman con `python3 scripts/generar-comercios.py`), medidas de punta a punta. Ya está publicada; falta probar con listas reales.

## Comandos

Para correr la app con la nube: copiá `.env.example` como `.env.local` y completá los datos del proyecto de Supabase. El esquema se carga con las migraciones de `supabase/migrations` (en el panel de Supabase, SQL Editor, o con `npx supabase db push`).

```bash
npm install
npm run dev       # app en modo desarrollo
npm run build     # sitio estático en dist/
npm test          # pruebas unitarias y de la base (Vitest + Postgres embebido, sin internet)
npm run test:e2e  # recorrido completo (Playwright), con la base embebida en el navegador
npm run build:e2e # build de los recorridos (base embebida, sin Supabase)
npm run typecheck # chequeo de tipos
```
