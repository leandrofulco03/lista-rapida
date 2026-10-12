# Listas de prueba en PDF (Fase 2, F05)

12 PDF con texto armados por nosotros, no listas reales. Imitan lo que suelen mandar los proveedores: membrete arriba, varias páginas con los títulos repetidos y número de página, rubros en negrita, subtotales, precios alineados a la derecha, con "$", dos columnas de precio, palabras escritas por separado, una lista apaisada de ferretería con 9 columnas y una de 1.500 productos.

Cada PDF tiene al lado un `.esperado.json` con las líneas que la app tiene que leer, calculadas por `scripts/generar-listas-pdf.py` a partir de los datos de origen (no con el código de la app). En un PDF, `filaOrigen` es el número de renglón con texto del documento, contando desde 1 de arriba hacia abajo y página por página. La prueba `src/parsers/listas-pdf.test.ts` mide cuántas se leen bien sin ayuda; la meta de la fase es 85%.

Aparte del set, `../pdf-escaneado.pdf` es un PDF sin texto (sólo dibujos), para probar el aviso de "parece un escaneo".

Para regenerarlas: `python3 scripts/generar-listas-pdf.py` (necesita `reportlab` y `openpyxl`).

**Límite:** las armamos sabiendo cómo las lee la app y con un solo programa (reportlab), así que el 12 de 12 es optimista. Los PDF reales salen de muchos sistemas distintos; antes del piloto hay que sumar PDF reales anonimizados.
