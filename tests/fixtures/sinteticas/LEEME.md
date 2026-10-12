# Listas de prueba sintéticas (Fase 2, F04)

20 listas armadas por nosotros (decisión de Leandro del 12/10/2026), no listas reales. Imitan formatos habituales: datos del proveedor arriba de la tabla, rubros, subtotales, títulos repetidos por página, CSV en Latin-1 con `;`, punto decimal, sin títulos, precio sugerido junto al de lista, tabla corrida, varias hojas y una lista de 3.000 productos.

Cada archivo tiene al lado un `.esperado.json` con las líneas que la app tiene que leer, calculadas por `scripts/generar-listas-prueba.py` a partir de los datos de origen (no con el código de la app). La prueba `src/parsers/listas-prueba.test.ts` mide cuántas se leen bien sin ayuda; la meta de la fase es 95%.

Para regenerarlas: `python3 scripts/generar-listas-prueba.py` (necesita `openpyxl`).

**Límite:** las armamos sabiendo cómo las lee la app, así que el porcentaje es optimista. Antes del piloto hay que sumar listas reales anonimizadas en `tests/fixtures/`.
