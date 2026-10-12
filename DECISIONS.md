# Decisiones

Registro de qué se eligió, qué se descartó y por qué. Lo más nuevo arriba.

## 12/10/2026 · Fase 6: piloto con comercios ficticios y nombre ListaMatch

- **Nombre:** la app pasa a llamarse ListaMatch (elegido por Leandro entre su lista de opciones). Cambia lo que se ve: título, manifest de la PWA y el archivo de la copia de seguridad (`listamatch-respaldo-AAAA-MM-DD.json`). No cambia lo interno: la base del navegador sigue siendo `lista-rapida` y la marca dentro de la copia también, así nadie pierde datos y las copias viejas se siguen leyendo.
- **Listas ficticias:** un kiosco, una ferretería y un almacén, con su catálogo y dos proveedores cada uno (Excel, CSV y PDF; con y sin códigos; con y sin IVA; una con la presentación en columna aparte), semana 1 y semana 2. Entre semanas: una suba del 65%, bajas, productos que dejan de venir y productos nuevos. Las listas traen productos que el comercio no tiene y que se parecen mucho (otro tamaño, otro sabor, otra marca). Se arman con `scripts/generar-comercios.py`; los precios son estimados, no de una lista real.
- **Medición a ciegas (antes de tocar nada), 6 proveedores:**
  - Lectura: 12 de 12 listas leídas completas y con el costo exacto, todas con confianza alta.
  - Semana 1: 60 de 96 líneas sugeridas bien con un toque, 1 sugerida mal (yogur de vainilla → el de frutilla), 6 que el comercio tenía quedaron como "nuevas" (5 de ferretería).
  - Semana 2: 89 de 90 vinculadas solas bien (99%), pero 4 líneas vinculadas o sugeridas mal.
- **Tres errores reales que encontró, corregidos:**
  - Sin códigos, la clave del vínculo no incluía la presentación: "Látex Albalatex blanco" de 4 l y de 20 l quedaban como el mismo. Ahora la presentación de su columna es parte de la clave. Las listas sin presentación aparte guardan la misma clave que antes; las que la tienen, la primera vez vuelven a sugerir en vez de vincular solas.
  - "6 mm" y "6MM" no se unificaban (tampoco amperes, watts y volts): ahora sí.
  - Otra variedad del mismo producto se sugería sola. Ahora no se sugiere si a cada descripción le sobra una palabra que la otra no tiene ("vainilla" contra "frutilla"), o si una dice light, zero, diet, descremada o integral y la otra no. Queda dudosa: elige el comerciante.
- **Después de corregir** (ya no es a ciegas, porque los errores salieron de este set): semana 1, 66 de 96 sugeridas bien y ninguna mal, ninguna "nueva" que existiera salvo "Halls Menthol Lyptus" contra "Pastillas Halls mentol"; semana 2, 90 de 90 solas y ninguna mal. La prueba (`src/parsers/comercios-ficticios.test.ts`) exige lectura exacta, ninguna sugerencia equivocada y al menos 85% solas en la segunda lista.
- **Pendiente:** el número que vale es el de listas reales de comercios del piloto.
- **Publicación:** en https://lista-rapida.leandro-fulco.workers.dev. Leandro conectó el repo a Cloudflare como Worker (no como Pages). El panel compila con `npm run build` y `wrangler.jsonc` sirve `dist/` como archivos estáticos, con cualquier ruta desconocida yendo a la app (`single-page-application`). Sin código del lado del servidor: todo sigue en el navegador.

## 12/10/2026 · Fase 5: lista de precios y CSV para la caja (F11)

- **CSV para Excel en castellano:** UTF-8 con BOM (sin el BOM, Excel muestra mal los acentos), separado por punto y coma (Excel en castellano usa la coma para decimales) y precio con coma decimal y sin separador de miles ("1580,50"), así Excel lo toma como número. Renglones con CRLF.
- **Columnas del CSV:** Código, Descripción, Rubro, Precio, IVA % y Actualizado. No sabemos todavía qué sistemas de caja usan los comercios (pregunta abierta de la spec); cuando lo sepamos, se suma un formato por sistema.
- **Sin fórmulas en el CSV:** un texto que empieza con =, +, - o @ lleva un apóstrofo adelante, para que Excel no lo ejecute como fórmula.
- **Lista para el mostrador en PDF:** A4, agrupada por rubro (en orden alfabético, "Sin rubro" al final), productos por descripción, renglones alternados en gris para seguir la línea con el ojo, precio con centavos alineado a la derecha y "Página N de M". Un rubro no empieza al pie de una hoja.
- **Qué productos:** todos, o los que cambiaron de precio en la última lista revisada. Los productos sin precio no se incluyen (se avisa cuántos son). Se llega desde el inicio y al terminar una revisión.

## 12/10/2026 · Fase 5: etiquetas para imprimir (F10)

- **pdf-lib (1.17.1)** para armar el PDF (la spec daba a elegir entre pdf-lib y jsPDF). pdf-lib no tiene dependencias y mide todo en puntos exactos; con jsPDF habría que cuidar más las unidades. Se baja sólo cuando se arma el PDF, como pdf.js.
- **Hoja A4 en tamaño real**, repartida en partes iguales: columnas × filas dentro de un margen. Formatos de fábrica: 24 (3 × 8), 40 (4 × 10), 21 (3 × 7) y 10 grandes (2 × 5), todos con margen de 10 mm para hoja común (las impresoras no imprimen al borde). En "Medidas a mano" se eligen columnas (1 a 6), filas (1 a 20) y margen (0 a 25 mm; 0 para hojas autoadhesivas que llegan al borde).
- **El formato se recuerda en el dispositivo** (almacenamiento del navegador), no en la configuración: depende de la impresora y del papel de cada equipo. No viaja en la copia de seguridad.
- **Cada etiqueta:** descripción en hasta dos renglones (si no entra, termina en "…"), precio grande a la derecha (sin centavos si son cero: "$ 1.580") y la fecha chica abajo. Borde gris finito para recortar. Los caracteres que la fuente del PDF no tiene (comillas tipográficas, guiones largos, emojis) se cambian por equivalentes o se sacan.
- **Qué productos:** al terminar una revisión, "Imprimir sus N etiquetas" lleva los que cambiaron (la spec: "imprime etiquetas sólo de lo que cambió"). Desde el inicio, "Etiquetas" arranca con los que cambiaron en la última lista revisada, y se pueden sacar o agregar del catálogo.
- **Pendiente:** la condición de F10 ("se imprimen alineadas en una impresora común") se prueba imprimiendo de verdad. El PDF mide exacto (verificado en las pruebas); lo que falta ver es el margen real de cada impresora. Si no alinea, se corrige con el margen.

## 12/10/2026 · Fase 5: copia de seguridad (F12)

- **Orden de la Fase 5:** primero F12, porque protege lo que el comerciante ya carga (todo vive sólo en su dispositivo). Decisión de Leandro. Después F10 (etiquetas) y F11 (lista de precios y CSV).
- **Archivo:** un JSON (`lista-rapida-respaldo-AAAA-MM-DD.json`) con todas las tablas, la versión del esquema y la fecha. Sin comprimir: se puede abrir y revisar, y con miles de productos sigue pesando poco.
- **Restaurar reemplaza todo** lo que hay en el dispositivo, en una sola transacción: si algo falla, no queda nada a medias. Se pide confirmación mostrando la fecha de la copia y cuántos productos y proveedores trae.
- **Versiones:** una copia de una versión anterior del esquema se migra al restaurar (hoy: recalcular la descripción normalizada de la versión 1). Una copia de una versión más nueva se rechaza con un aviso para actualizar la app.
- **Otro dispositivo:** en la primera pantalla (antes de configurar) está "Tengo una copia de seguridad", para no tener que configurar nada antes de restaurar.
- **Recordatorio semanal:** en el inicio, si hay productos o proveedores y nunca se hizo una copia, o pasaron 7 días o más. La fecha de la última copia se guarda al generar el archivo (no podemos saber si el comerciante lo guardó bien), y va dentro de la copia, así no salta el aviso apenas se restaura.
- **Pendiente:** compartir la copia directo a WhatsApp o Drive desde el celular (con la función de compartir del sistema), si con el piloto vemos que bajar el archivo es incómodo.

## 12/10/2026 · Fase 4: revisión de precios (F09)

- **Orden:** Leandro eligió seguir con la Fase 4 antes de probar con listas reales.
- **Recorrido:** subir la lista → columnas → "Comparar con mi catálogo" (F07) → "Revisar precios" (F09) → guardar. Ningún precio cambia en otro lado: `aplicarRevision` es el único que actualiza precios desde una lista.
- **Costo que guarda el catálogo:** el de la lista con los descuentos del proveedor y sin IVA (si la lista lo incluía, se saca con la alícuota del producto). La variación se mide sobre ese costo, contra el costo que tenía el producto.
- **Precio sugerido:** el de F08, con el costo de la lista, los descuentos, el IVA y el recargo del producto, rubro o general. Si la lista incluye IVA y el comercio vende sin IVA, el IVA queda como parte del costo (igual que en F08).
- **Controles de seguridad (spec):**
  - Más del 15% de variación: resaltado en amarillo. Arriba van los de mayor variación.
  - Más del 50%, costo en cero, o producto sin costo anterior para comparar: en rojo, fuera de "Aprobar todo"; se aprueban de a uno. Lo de "sin costo anterior" lo sumamos nosotros: sin costo no hay forma de saber si el cambio es razonable.
  - Si el costo baja: marcado en azul, con "Bajar a $X" o "Mantener $Y". "Aprobar todo" las incluye con el precio nuevo; se puede deshacer y mantener.
  - Productos vinculados antes con este proveedor que no vinieron en la lista: aviso "No vinieron en esta lista", sin cambios.
- **"Aprobar todo" marca, no guarda:** se ve qué quedó aprobado y después se guarda con un botón fijo abajo. Mantener el precio igual actualiza el costo.
- **Líneas repetidas** (dos líneas con el mismo producto): vale la primera; la otra se lista como repetida y no cambia nada.
- **Al guardar** queda un registro en el historial de cada producto y la importación con todas sus líneas (aprobadas o no). No se guarda un borrador a medio revisar: si se sale, se vuelve a subir la lista y los vínculos ya están.
- **Pendiente:** la condición de la fase ("300 productos se revisan en menos de 5 minutos") se mide con una persona y una lista real; dar de alta en el catálogo los productos que no están; editar a mano el precio final en la revisión.

## 12/10/2026 · Fase 3: vinculación con el catálogo (F07)

- **Comparador propio en vez de Fuse.js** (la spec nombraba Fuse.js). Fuse compara letras sueltas y con descripciones de almacén confundía productos de la misma marca. El comparador propio compara palabras: iguales valen 1, abreviatura ("ent" de "entera") 0,8, una letra de diferencia 0,7, y "x50" contra "50" 0,9; sin palabras vacías ("de", "con", "x"). Sin dependencias nuevas. Un índice por palabra evita comparar cada línea con todo el catálogo.
- **Descripción normalizada con unidades unificadas:** "1 lt", "1l" y "1000 cc" → "1000ml"; "1 kg" y "1000 grs" → "1000g"; "x6", "pack 6" y "6 un" → "x6"; "30 mts" → "30m". Se usa también para buscar en el catálogo. La versión 2 de la base recalcula las descripciones ya guardadas.
- **Umbrales** (constantes en `src/domain/vinculacion.ts`): desde 0,8 se sugiere; entre 0,5 y 0,8 es dudosa (se muestran hasta 3 opciones); debajo de 0,5 es nueva. Además, una sugerida tiene que sacarle al menos 0,05 a la segunda opción, y si el contenido o el pack no coinciden (500 g contra 1 kg) nunca se sugiere: queda dudosa.
- **Calibración:** set de 30 productos y 40 líneas escritas como las escriben los proveedores (`tests/fixtures/vinculacion/casos.json`). Resultado: 31 de 31 existentes sugeridas con el producto correcto, ninguna sugerida equivocada, las 9 que el comercio no tiene quedan dudosas o nuevas. **La medida es optimista:** ajustamos la normalización mirando los fallos de este mismo set ("Hellmann's", "3x101g", "mts", "x50"). Hay que medirlo con listas reales.
- **Vínculo recordado por proveedor:** la clave es el código de la línea en minúsculas; si la lista no trae códigos, la descripción normalizada (`desc:…`). Desde la segunda lista, lo confirmado se vincula solo; la prueba con el set da 100% de las que existen (meta: 85%), con y sin códigos.
- **Pantalla de vinculación** después de leer la lista ("Comparar con mi catálogo"): arriba las dudosas (elegir entre opciones o buscar), después las sugeridas (se confirman todas con el botón de guardar; "No es este" para rechazar una), y plegadas las que no están y las ya vinculadas (se pueden cambiar). Sólo se guarda lo que el comerciante confirmó.
- **Pendiente:** dar de alta en el catálogo los productos que no están.

## 12/10/2026 · Fase 3: proveedores (F02) y catálogo propio (F03)

- **Orden de la Fase 3:** primero F02 y F03, después F07 (vinculación), todo en el mismo PR. Decisión de Leandro: seguir con la Fase 3 antes de probar con listas reales.
- **Ficha del proveedor:** nombre, si su lista trae IVA, descuentos en cascada escritos como "10 + 5" (muestra el total equivalente, 14,5%) y las columnas recordadas, con un botón para olvidarlas. La baja borra sus vínculos e importaciones; los productos del catálogo quedan.
- **Catálogo:** búsqueda por palabras sueltas o código, sin acentos. Se muestran 100 productos a la vez; el resto se encuentra buscando.
- **Código interno automático** (P0001, P0002…) para productos sin código; se puede cambiar. El código no se repite (sin importar mayúsculas).
- **Rubros con recargo opcional.** Al borrar un rubro, sus productos quedan sin rubro y usan el recargo general (o el propio).
- **Precio de venta sugerido:** en la ficha del producto se muestra lo que daría el cálculo de F08 con su costo y recargo, y se usa con un toque. No se pisa solo: el precio de venta lo decide el comerciante.
- **Importar catálogo** desde Excel, CSV o PDF, con la misma pantalla de columnas que las listas (ahora compartida en `SelectorColumnas`). Campos: código, descripción, rubro, costo, precio de venta e IVA. Con un solo "Precio" se toma como precio de venta (es el catálogo del comercio, no una lista de proveedor).
  - Un producto que ya existe (mismo código; si el archivo no trae código, misma descripción) se actualiza y conserva lo que el archivo no trae (costo, recargo propio, rubro).
  - Sin precio de venta, se calcula desde el costo con el recargo y el redondeo del comercio. **Supuesto:** el costo del catálogo está sin IVA. Sin costo ni precio, queda en cero.
  - Un renglón con un solo texto y sin precios es un título de rubro; si el archivo no tiene columna de rubro, los productos de abajo quedan en ese rubro.
  - Códigos repetidos en el archivo: vale el primero y los demás se listan como salteados.
- **Condición de F03:** un Excel sintético de 500 productos (`tests/fixtures/catalogo/`) se importa completo, en la prueba unitaria y en el recorrido de Playwright.

## 12/10/2026 · Fase 2: lectura de listas en PDF (F05)

- **pdf.js (`pdfjs-dist` 6.3.289), versión "legacy"**, como pide la spec. La versión moderna usa funciones que no tienen los navegadores de celulares de hace un par de años (por ejemplo `Promise.try`); la legacy funciona en ellos.
- **Columnas por posición:** los textos a la misma altura forman un renglón; los textos pegados (menos de media letra de distancia) son una misma celda; las columnas son las franjas horizontales que ocupan los textos en los renglones con más de un dato. Una franja cuenta si la ocupa más del 5% de esos renglones, así un título o un rubro que cruza columnas no las junta. Un texto suelto (membrete, rubro, pie de página) queda en la columna donde empieza, como en Excel.
- **Después de armar la tabla, todo sigue igual que en Excel/CSV:** detección de títulos, mapeo recordado por proveedor (F06) y filas salteadas con su motivo. En un PDF, "fila" es el número de renglón con texto del documento, de arriba hacia abajo y página por página.
- **Rubros:** un renglón con un solo texto y sin precio se toma como rubro, esté en la columna que esté (en los PDF suelen ir sobre el margen, debajo de "Código"). Antes sólo se reconocían en la columna de la descripción. Vale también para Excel y CSV.
- **Motor de pdf.js en su propio Web Worker,** abierto desde el worker de lectura. Descartado: cargarlo dentro del worker de lectura (pdf.js se adueña de los mensajes del worker donde se carga y la lectura se colgaba). El código de PDF se baja sólo cuando se sube un PDF, pero queda guardado para usar la app sin conexión.
- **PDF escaneados (sin texto):** se avisa que parece una foto y se sugiere pedir Excel o un PDF hecho en computadora. Leer fotos es F13 (con IA, fuera del MVP). PDF con contraseña: se avisa.
- **12 PDF de prueba sintéticos** (`tests/fixtures/sinteticas-pdf/`) armados con reportlab; se leen 12 de 12 (meta: 85%). La medida es optimista: todos salen del mismo programa y los armamos sabiendo cómo los lee la app.
- **Pendiente para con PDF reales:** descripciones partidas en dos renglones, tablas en dos columnas por página y PDF con columnas muy juntas. Se ven cuando tengamos listas reales.

## 12/10/2026 · Fase 2: lectura de listas Excel y CSV (F04, F06)

- **Orden:** Excel/CSV primero; PDF (F05) en un PR aparte; WhatsApp (Web Share Target) después. Decisiones de Leandro (respuestas 1B 2A 3A 4A 5B).
- **Listas de prueba sintéticas** (20, en `tests/fixtures/sinteticas/`) en vez de listas reales. Se leen bien 20 de 20, pero la medida es optimista porque las armamos nosotros.
- **La app adivina y el usuario corrige:** busca la fila de títulos en las primeras 30 filas por palabras conocidas ("Cód. Art.", "Descripción", "Precio s/IVA") y lo que hay debajo; si no hay títulos, adivina por el contenido y avisa que no está segura. Descartado: mapeo siempre a mano (más lento).
- **"Precio sugerido", "PVP" y "Precio venta" nunca se toman como costo.** Con dos precios se prefiere el sin IVA. Si el título dice "c/IVA" o "s/IVA" manda eso; si no, lo que diga el proveedor.
- **Números ambiguos:** "1.234" es mil doscientos treinta y cuatro (formato argentino) salvo que la columna use punto decimal ("1234.50"); el formato se deduce por columna. Más de 2 decimales se redondean al centavo.
- **Mapeo recordado por proveedor** con los títulos de cada columna, así se reencuentra aunque el proveedor agregue filas arriba o cambie el orden. Si ya no lee al menos el 80% de las filas, vuelve a preguntar. Sin títulos, se reusa por posición.
- **Ninguna fila se descarta en silencio:** rubros, totales, títulos repetidos y precios como "Consultar" se listan con el motivo.
- **CSV con lector propio** (detecta `;` `,` tabulador y Latin-1/UTF-8) en vez de SheetJS, porque los CSV de Excel en Windows rompen acentos y separadores. Excel y ODS con SheetJS. Ambos corren en un Web Worker; SheetJS queda sólo en el worker y no agranda la carga inicial.
- **SheetJS desde su CDN oficial** (`cdn.sheetjs.com`, versión 0.20.3), como pide la spec. El `package-lock.json` no tiene el hash del paquete porque el entorno de Claude no llega a ese CDN; se completa solo la próxima vez que Leandro corra `npm install`.
- **Proveedor mínimo al subir:** se elige uno o se escribe el nombre de uno nuevo (sin duplicar por mayúsculas). La ficha completa es F02 (Fase 3).
- **Por ahora sólo se muestra lo leído y se guarda el mapeo;** la importación en borrador y los cambios de precio llegan con F07 y F09.
- **Tipo `MapeoColumnas`** pasa a `src/domain/columnas.ts` con `filaEncabezado` que admite `null` (lista sin títulos) y `titulos`. No cambia índices de Dexie, así que no hace falta versión nueva del esquema.

## 12/10/2026 · Fase 1: base de la app y F01

- **F01 en una sola pantalla** con nombre, recargo general (sugerido 30%), redondeo (sugerido a $10) y, en opciones avanzadas, IVA en el precio de venta (sí por defecto) e IVA de productos nuevos (21% o 10,5%). Descartado: asistente en pasos (más lento). Los rubros se crean en F03. Decisiones de Leandro.
- La pantalla muestra un ejemplo vivo ("$ 1.000 + IVA lo venderías a $ 1.580") calculado con `calcularPrecioVenta`, para que se entienda el recargo sin explicaciones.
- **Ejemplo desglosado paso a paso** (pedido de Leandro): costo, + IVA, + recargo y + redondeo, cada uno en % y en $ con el subtotal que queda ("+ IVA 21%: $ 210,00 → $ 1.210,00"). Sale de `desglosarPrecio` (`src/domain/desglose.ts`): el precio final sigue viniendo de `calcularPrecioVenta`; los pasos intermedios se redondean al centavo sólo para mostrarlos y siempre suman el precio. Montos con centavos, como en el resto de la app.
- **Esquema Dexie v1** con las 8 tablas de la spec. Campos en camelCase (convención de TypeScript) en vez del snake_case de la spec; mismos datos. `config` es una sola fila con id fijo `comercio`. `historialPrecios` suma un `id` autoincremental. Recargos con el nombre `recargoPct` (la spec dice `margen_pct`) para no confundir recargo con margen.
- **Nombre y descripción** en un solo archivo (`src/marca.ts`), que usan la interfaz y el manifest.
- **Pospuesto:** Web Share Target (recibir archivos desde WhatsApp) va con la pantalla de subir lista (Fase 2), que es la que lo usa.
- **Pruebas de punta a punta** con Playwright en un celular emulado (Pixel 7).

## 12/10/2026 · Fase 1: los 20 casos de control los calcula Claude

- **Elegido:** Claude calculó los 20 casos de la planilla con un cálculo aparte (aritmética decimal paso a paso, sin usar el código de la app). Leandro validó el procedimiento con el caso 1. Los 20 coinciden al centavo (`src/domain/casos-a-mano.test.ts`).
- **Descartado:** que Leandro los calcule a mano (lo delegó).
- **Por qué:** decisión de Leandro. **Límite:** el control es independiente del código, pero no de la interpretación de las reglas: si una regla se entendió mal, los dos cálculos fallan igual. Conviene que un comerciante revise algunos casos en el piloto.

## 12/10/2026 · F08: porcentajes en centésimos de punto

- **Elegido:** todo porcentaje es un entero en centésimos de punto (21% = 2100; 10,5% = 1050; 33,33% = 3333).
- **Descartado:** guardar porcentajes como decimales (0.105). Mezclar decimales con centavos enteros reintroduce los errores de redondeo que los centavos evitan.
- **Por qué:** con montos y porcentajes enteros, el cálculo completo es exacto.

## 12/10/2026 · F08: cálculo exacto y un solo redondeo al final

- **Elegido:** `P = redondeo(C · (1 − d) · (1 + i) · (1 + m))` se calcula como fracción exacta con BigInt y se redondea una sola vez, siempre hacia arriba.
- **Descartado:** redondear a centavos en cada paso (acumula diferencias de centavos contra el cálculo manual).
- **Por qué:** la condición de la Fase 1 es coincidir al centavo con el cálculo a mano; redondear hacia arriba garantiza no vender por debajo del costo.
- Costo cero devuelve precio cero (con "terminado en 90" daría $ 90, que es engañoso); la revisión (F09) lo marca como probable error.

## 12/10/2026 · F08: "terminado en 90 / 99"

- **Elegido:** el próximo precio en pesos enteros, hacia arriba, cuya terminación sea 90 o 99 (1.234 → 1.290 / 1.299; 1.290 queda igual; 1.290,01 → 1.390).
- **Descartado:** terminación en la decena (1.234 → 1.239).
- **Por qué:** decisión de Leandro (pregunta 4 del arranque).

## 12/10/2026 · F02/F08: descuentos del proveedor en cascada

- **Elegido:** el proveedor guarda una lista de descuentos que se aplican uno tras otro (10% + 5% = 14,5% efectivo).
- **Descartado:** un solo `descuento_pct`, como dice la spec.
- **Por qué:** las bonificaciones en cascada son habituales en Argentina y migrar de un número a una lista después es caro. Decisión de Leandro (pregunta 3). **Desvío de la spec:** la tabla `proveedores` tendrá `descuentos_pct` (lista) en lugar de `descuento_pct`.

## 12/10/2026 · F08: alícuotas de IVA

- **Elegido:** IVA por producto, 21% por defecto y 10,5% disponible.
- **Descartado:** sólo 21% (deja mal calculados alimentos básicos y otros productos al 10,5%); sumar 27% (rara vez lo vende un comercio chico).
- **Por qué:** decisión de Leandro (pregunta 5). El dominio acepta cualquier alícuota; la limitación a 21/10,5 va en la interfaz.

## 12/10/2026 · Se saltea la Fase 0 (validación)

- **Elegido:** arrancar directo con la Fase 1, sin visitas ni listas reales.
- **Descartado:** validar primero (lo que pide la spec) o hacerlo en paralelo (lo recomendado).
- **Por qué:** decisión de Leandro (pregunta 1).
- **Consecuencias:**
  - La condición de la Fase 1 ("F08 coincide con 20 precios calculados a mano por comerciantes") se reemplaza por 20 casos calculados a mano por Leandro, sin mirar el resultado del código.
  - Las condiciones de la Fase 2 (95% de listas Excel/CSV y 85% de PDF leídas bien) necesitan listas reales en `tests/fixtures/`; sin ellas no se pueden medir.
  - Quedan abiertas las preguntas que respondía la Fase 0, entre ellas si los comercios remarcan por recargo sobre costo o por margen sobre precio. La spec usa recargo.
