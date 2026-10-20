# Decisiones

Registro de qué se eligió, qué se descartó y por qué. Lo más nuevo arriba.

## 20/10/2026 · v2: rediseño y nombre Vendia

- **Nombre:** la app pasa a llamarse **Vendia** (decisión de Leandro). Cambian el título, el manifest, el logo (una "V" crema sobre verde) y los íconos de la PWA (`node scripts/generar-iconos.mjs`). La pantalla para traer la copia de seguridad sigue nombrando a ListaMatch, porque es la versión anterior.
- **Pensada como web app, adaptada al celular:** menú de secciones a la izquierda, agrupado (Ventas, Precios, Comercio), fijo desde 1024 px. En el celular se esconde detrás del botón de menú de la barra de arriba y se abre como cajón: se cierra al elegir, con Escape o tocando afuera, lleva el foco adentro y lo devuelve al botón. La cuenta y "Salir" van al pie del menú.
- **Colores:** verde #31493C (marca) y crema #FAFADE (fondo), pedidos por Leandro. Se redefinieron las escalas `green` y `stone` de Tailwind en `src/index.css`, así todas las pantallas cambiaron sin tocar sus clases; los grises de texto superan 4,5:1 sobre el crema y sobre las tarjetas. Los gráficos de una sola serie y el mapa de calor pasan al verde de la marca; la torta mantiene la paleta categórica validada.
- **Tipografía:** Plus Jakarta Sans, incluida en la app (no desde Google Fonts), para que ande sin conexión y sin tocar la política de seguridad.
- **Inicio como panel:** vendido hoy contra ayer, ventas, ticket promedio, la semana, las últimas 6 ventas y cómo pagaron. Los accesos a las secciones salieron del inicio porque ya están en el menú.
- **Pantallas más anchas en la compu:** formularios medianos y listas, ventas y análisis anchos. Vender pasa a dos columnas (buscar a la izquierda, ticket y cobro a la derecha); en el celular sigue la barra de cobro fija abajo.
- **Ingreso:** en la compu, panel de marca a la izquierda y formulario a la derecha.
- **Pruebas:** los recorridos navegan con el menú (`irA`, `salir` en `e2e/ayudas.ts`) y hay uno nuevo (`diseno.spec.ts`) que prueba el menú en la compu y en el celular.

## 22/10/2026 · v2 Fase 9: análisis

- **Pantalla Análisis** (sólo el dueño, desde el inicio y desde Ventas), con un período arriba que vale para todo: 7 días, 30 días, este mes, mes pasado, 90 días. Al cambiarlo, lo anterior queda atenuado hasta que llegan los datos (sin parpadeo).
- **Ganancia = lo cobrado − lo que costó.** El costo del catálogo está sin IVA y el recargo se aplica sobre costo + IVA cuando se vende con IVA incluido (F08); en ese caso el IVA cuenta como costo (lo que paga un monotributista, que no lo recupera). Así la ganancia coincide con el recargo: 30% de recargo = 23,1% de margen. Si el comercio vende sin IVA, la ganancia es precio − costo. Lo vendido sin costo conocido ("Varios", productos con costo 0) y el total del día no entran en la ganancia, y la pantalla lo dice con el monto. Descartado: un ajuste por condición fiscal (responsable inscripto); se suma si el piloto lo pide.
- **El IVA de cada línea se guarda al vender** (como el costo). Las ventas anteriores usan el IVA del producto, o 21%.
- **Gráficos hechos a mano** (SVG y HTML, `src/ui/graficos/`), sin librería: son cuatro formas simples y una librería sumaba unos 100 kB. Siguen la guía de visualización: línea de 2px con lavado suave, grilla fina, una sola serie sin leyenda, barras finas de un color con el valor en la punta, torta con hasta 5 porciones + "Otros" (con más, no se lee), mapa de calor de un solo tono (5 pasos) con escala. Cada gráfico tiene tooltip con mouse, dedo y teclado, y "Ver los datos" con la tabla.
- **Colores de los gráficos como variables** en `src/index.css` (`--graf-*`), para cambiarlos en el rediseño. La paleta categórica (5 colores, orden fijo) pasó el validador de daltonismo; tres colores tienen poco contraste con el fondo blanco, por eso la leyenda lleva siempre el valor y el porcentaje escritos.
- **Torta de más vendidos** (la pidió Leandro), por plata o por unidades, con los 5 primeros y "Otros". Debajo, los 10 que más facturaron en barras, con unidades y ganancia.
- **Mapa de día y hora** en horario de Argentina, de la primera a la última hora con ventas.
- **Precios para revisar** (se calcula en la app con F08): vende a pérdida (por debajo de costo + IVA), por debajo del precio que da su recargo (más de 2% abajo) o sin cambios hace 45 días o más. Los productos sin costo no se pueden evaluar.
- **Sin movimiento:** productos sin ventas en los últimos 30 días (o que nunca se vendieron).
- **Seguridad, corregido:** en la Fase 8 el empleado podía leer directo las líneas de sus ventas, que traen el costo. Ahora esa tabla no se lee directo: las ventas del día y el análisis se leen por funciones que controlan quién llama.
- **Bug corregido:** varios códigos escritos o escaneados seguidos mientras cargaban los productos se perdían (sólo quedaba el último). Ahora esperan en fila y se agregan todos.

## 21/10/2026 · v2 Fase 8: ventas

Decisiones de Leandro: el empleado ve sus tickets de hoy; se permite "Varios" con importe a mano; el empleado anula sus ventas del día y el dueño cualquiera, y la venta anulada queda marcada (no se borra).

- **Dos formas de cargar, que se suman:** ticket por ticket, o "Total del día" (sólo el dueño) por medio de pago. La venta total de un período es tickets + total del día; el ticket promedio y los artículos salen sólo de los tickets, y el resumen avisa cuánto vino sin detalle. Si un día tiene tickets y total, el total es "lo que no se cargó por ticket" (lo dice la pantalla). Descartado: que el total del día reemplace a los tickets de ese día (habría que decidir cuál vale y se pierde uno de los dos).
- **Tablas `ventas` y `venta_items`** (`supabase/migrations/20261021000000_ventas.sql`). Se escriben sólo por funciones; el dueño lee todas y el empleado las suyas (RLS).
- **El costo se guarda en cada línea al vender**, desde la base (el empleado no lo ve), para calcular la ganancia real en la Fase 9 aunque después cambie el costo.
- **Sin conexión:** cada venta se guarda primero en el dispositivo (Dexie, `src/db/cola.ts`) con un id creado ahí, y se manda a la base; si no hay internet, se reintenta al volver la conexión y cada 30 segundos. La base no duplica una venta que llega dos veces (mismo id). Una venta que la base rechaza queda marcada con el error, a la vista, y se puede descartar. La lista de productos para vender (sin costos) y los más vendidos también se guardan en el dispositivo, para buscar y escanear sin internet. Un producto borrado mientras la venta esperaba queda como línea sin producto.
- **El día es el de Argentina** (`America/Argentina/Buenos_Aires`): una venta a las 23:30 cuenta en ese día, no en el siguiente de UTC. La semana va de lunes a domingo.
- **Precio de cada línea:** el del producto al momento de agregarlo al ticket (el que vio el cliente). La base calcula subtotales y total; no confía en el total que manda el dispositivo.
- **Cantidades con hasta 3 decimales** (fiambre por kilo). Se tocan con − y + o se escriben.
- **Escáner:** con el detector de códigos del navegador (BarcodeDetector: Chrome en Android y computadoras). Donde no existe, el botón no aparece; un lector de códigos USB/Bluetooth funciona igual porque escribe el código y Enter en el buscador. Un código que llega antes de que carguen los productos se agrega apenas cargan. Descartado por ahora: una librería de lectura propia (zxing, ~400 kB) para iPhone; se suma si el piloto lo pide.
- **Resumen (sólo el dueño):** día, semana o mes, contra el período anterior: venta total, ventas, ticket promedio, artículos, artículos por venta y cómo pagaron. Los gráficos son de la Fase 9.
- **Inicio:** el dueño tiene "Nueva venta" como acción principal, con "Ventas" y "Subí una lista" debajo; el empleado, "Nueva venta" y "Mis ventas de hoy".
- **Medios de pago:** efectivo, débito, crédito, Mercado Pago/QR y transferencia (fijos por ahora).

## 20/10/2026 · v2: de "actualizar precios" a "manejar el almacén o kiosco"

Cambio de rumbo decidido por Leandro. La app sigue comparando las listas de los proveedores con los precios del comercio, pero se enfoca en almacenes y kioscos y suma ventas y análisis.

- **Tres secciones:** Ventas (carga y KPIs), Precios (todo lo de la v1) y Análisis (gráficos).
- **Carga de ventas: las dos formas.** Ticket por ticket con productos (búsqueda, código de barras con la cámara y botones de los más vendidos) o sólo el total del día para quien no quiera cargar el detalle. Los días cargados con total suman a la venta total, pero no al ticket promedio ni a los productos más vendidos; los KPIs avisan cuántos días no tienen detalle.
- **Ideas que entran** (de la lista propuesta): ganancia y margen real; medios de pago; cierre y arqueo de caja; fiado de clientes; alerta de precios atrasados; stock simple y sugerencia de pedido; ventas por día y hora; productos sin movimiento; gastos fijos y resultado neto. Queda afuera por ahora: comparar el mismo producto entre proveedores.
- **Usuarios:** el admin (dueño) hace todo; el empleado sólo carga ventas. El empleado no ve costos, márgenes, proveedores ni análisis.
- **Fases:**
  - **Fase 7, base en la nube:** Supabase, cuentas, roles, invitaciones, pasar los datos de la v1 desde la copia de seguridad y publicar en Vercel. La sección Precios funciona igual que hoy, pero en la nube.
  - **Fase 8, ventas:** carga por ticket y por total del día, medios de pago, ventas sin conexión y KPIs (venta total, tickets, ticket promedio, artículos, artículos por ticket; por día, semana y mes, contra el período anterior).
  - **Fase 9, análisis:** ingresos por día, más vendidos, ventas por rubro, ganancia y margen, mapa de día y hora, sin movimiento y precios atrasados.
  - **Fase 10, caja y clientes:** arqueo, fiado, stock y sugerencia de pedido, gastos fijos y resultado neto.

### Fase 7: base en la nube

- **Supabase (Postgres) como fuente de verdad.** Los datos dejan de vivir sólo en el navegador: el dueño y el empleado ven lo mismo desde distintos dispositivos y ya no depende de la copia de seguridad manual.
- **Sin conexión, sólo para vender.** La sección Precios necesita internet (subir listas ya lo pedía en la práctica). Las ventas se guardan primero en el dispositivo (Dexie) y suben cuando hay conexión, para que un corte no frene el mostrador (Fase 8). Descartado: sincronizar toda la base en los dos sentidos (resolver conflictos entre dispositivos es mucho trabajo para lo que se gana).
- **Ids uuid** en vez de números autoincrementales: la app puede crear una venta sin conexión sin chocar con la de otro dispositivo.
- **Cada tabla lleva `comercio_id`** y las claves foráneas lo incluyen (`(comercio_id, rubro_id)` → `rubros (comercio_id, id)`), así una fila nunca apunta a datos de otro comercio, aunque la app tenga un error.
- **Reglas de acceso (RLS)** en `supabase/migrations/20261020000000_base.sql`:
  - Sin sesión no se ve nada.
  - El admin hace todo dentro de su comercio. Cambia roles y da de baja miembros, pero no a sí mismo (un comercio no se queda sin dueño por error).
  - El empleado no ve la tabla de productos: ve la vista `productos_venta` (código, código de barras, descripción, rubro y precio, sin costo ni recargo), de sólo lectura. Una vista simple de Postgres acepta escrituras; sin quitarle ese permiso, un empleado podría cambiar precios por ella.
  - Los comercios y los miembros se crean sólo por funciones: `crear_comercio` (quien lo crea queda como admin, con su configuración) y `unirse_con_codigo`.
- **Invitaciones con código:** el admin genera un código de 12 letras que dura 7 días y se usa una vez; el empleado se registra con su email y lo escribe. Descartado por ahora: que el dueño cree la cuenta del empleado con usuario y PIN (necesita una función del lado del servidor con la clave de administración de Supabase); se suma si en el piloto los empleados no tienen email a mano.
- **Código de barras** en el producto (6 a 14 dígitos, no se repite en el comercio), para escanear al vender.
- **Las pruebas de la base corren sin Docker:** `supabase/pruebas/base.test.ts` levanta un Postgres embebido (PGlite) con lo mínimo de Supabase (`auth.uid()` y los roles `anon` y `authenticated`) y prueba como el dueño, el empleado y otro comercio. Corren con `npm test`.
- **Vercel, plan gratis (Hobby).** Elegido por Leandro. **El plan Hobby es sólo para uso no comercial:** cuando se cobre a los comercios hay que pasar a Pro o volver a Cloudflare, que permite uso comercial gratis. `vercel.json` compila con `npm run build`, sirve `dist/`, manda cualquier ruta a la app y pone las cabeceras de seguridad (antes en `public/_headers`); `vite preview` las lee de ahí para las pruebas e2e. Se borran `wrangler.jsonc` y `public/_headers`.
- **Cabeceras nuevas:** la app se conecta a `*.supabase.co` (también por websocket) y puede usar la cámara del propio sitio (escanear códigos en la Fase 8).
- **Supabase gratis:** alcanza para el piloto (500 MB). Un proyecto gratis se pausa tras 7 días sin uso; un comercio que vende todos los días no llega a eso.

### Fase 7: la app en la nube (20/10/2026)

- **La app lee y escribe sólo con funciones de la base (RPC)**, en `supabase/migrations/20261020010000_funciones_precios.sql` y `20261020020000_equipo.sql`. Corren con los permisos de quien llama (`security invoker`), así que las reglas de acceso se aplican igual, y cada una es una transacción: importar el catálogo, dar de alta desde la lista o aplicar una revisión se guardan enteros o no se guarda nada (como hacía Dexie). Los mensajes de error para el comerciante salen de la base, en castellano.
- **Dos backends con la misma interfaz** (`src/nube/backend.ts`): Supabase en producción y Postgres embebido (PGlite) con las mismas migraciones para las pruebas y los recorridos e2e. Así las pruebas no necesitan internet ni Docker, y prueban también las reglas de acceso. Descartado: probar contra el Supabase real en cada `npm test` (crea usuarios de verdad y depende de la red); queda `src/nube/supabase.integracion.test.ts` para correr a mano.
- **Recorridos e2e:** `npm run build:e2e` compila con la base embebida (`.env.e2e`). Cada prueba arranca creando la cuenta del dueño y su comercio. El build de producción no la incluye (17 MB): la elección se resuelve al compilar. La base embebida necesita WebAssembly: la política de seguridad suma `'wasm-unsafe-eval'` (permite compilar WebAssembly, no `eval` de JavaScript).
- **La lógica de precios no cambió de lugar:** vinculación, revisión, cálculo de precios e importación del catálogo se siguen decidiendo en la app (`src/domain`); la base sólo guarda. Los ids pasan de números a uuid en todo el dominio; los uuid de lo nuevo se crean en la app (`crypto.randomUUID`) para guardar varias tablas de una vez.
- **Entrada:** email y contraseña, iguales para dueños y empleados. Quien no tiene comercio elige "Crear mi comercio" (la configuración de F01) o "Tengo un código". El empleado, por ahora, ve sólo una pantalla que confirma que está en el equipo: la carga de ventas es la Fase 8.
- **Equipo** (desde el inicio, sólo el admin): lista de miembros con su email (se guarda en `miembros` al entrar, porque la app no puede leer los usuarios de Supabase), códigos vigentes, "Generar código", "Anular" y "Quitar".
- **Sin copia de seguridad:** con los datos en la nube se sacan la copia manual, su recordatorio y "Tengo una copia de seguridad". Queda "Traer datos de la versión anterior" (en Configuración), que lee la copia JSON de la v1, pasa sus ids a uuid y reemplaza la sección Precios del comercio en una transacción; se queda con el nombre del comercio de ahora. Vínculos o líneas que apuntan a filas que no existen en la copia se dejan afuera.
- **Lista de productos de una vez:** las funciones de lectura devuelven un solo JSON con todo el catálogo, porque Supabase corta en 1000 filas las respuestas de una función que devuelve filas.
- **Código de barras** en el producto (todavía no se edita en pantalla: llega con la Fase 8). Si la app no lo manda al editar, la base deja el que tenía. La búsqueda del catálogo también lo encuentra.
- **Pendiente:** cargar las migraciones 2 y 3 en el Supabase real, cargar las variables en Vercel y conectar el repo; mails propios (Resend u otro) antes de usarla con comercios reales; varios comercios por cuenta (hoy se abre el primero).

## 13/10/2026 · Alta desde la lista (F07/F03) y precio a mano en la revisión (F09)

Dos pendientes de la Fase 3 y la Fase 4, antes del piloto con comercios reales.

- **Alta en el catálogo desde la vinculación:** en las líneas que no están, en las dudosas y en las sugeridas rechazadas hay un botón "Dar de alta"; debajo de las que no están, "Dar de alta las N que no están" para todas juntas.
  - **Qué se carga:** la descripción de la línea (con la presentación si la lista la trae en otra columna y la descripción no la dice), el código de la línea como código interno, sin rubro, sin recargo propio y con el IVA de productos nuevos de la configuración. Si el código ya es de otro producto, está vacío o tiene más de 30 letras, va uno automático (P0001…).
  - **Sin rubro:** las líneas de la lista no traen el rubro (los títulos de rubro de la lista se saltean al leerla), así que lo más simple es dejarlo vacío; usa el recargo general hasta que el comerciante le ponga uno. Descartado: guardar el rubro de cada línea al leer la lista y crearlo si no existe; se suma si el piloto lo pide.
  - **Sin costo ni precio:** el producto se crea con costo y precio en cero, y en la revisión (F09) aparece como "sin costo anterior": en rojo, fuera de "Aprobar todo", se aprueba de a uno. Así se respeta que ningún precio se guarde fuera de la revisión.
  - **Queda vinculado en el momento:** el producto y su vínculo con la línea del proveedor se guardan juntos (una transacción), así la próxima lista lo reconoce solo aunque se salga sin guardar la vinculación. "Deshacer" borra el producto y su vínculo. Una línea repetida en la lista va con un solo producto.
  - **Descartado:** dar de alta desde un catálogo vacío (con 300 líneas serían 300 aprobaciones de a una en la revisión; para eso está importar el catálogo).
- **Precio a mano en la revisión:** cada cambio tiene "Otro precio", que abre un campo con el sugerido para corregir. Se aprueba con ese precio y el historial y la línea de la importación guardan el precio elegido (y el sugerido, para comparar).
  - **Validación** (`evaluarPrecioManual`, en `src/domain/revision.ts`): tiene que ser un número mayor que cero y hasta $ 100.000.000. Si queda por debajo de lo que cuesta, se acepta con un aviso en rojo ("vendés a pérdida"): lo decide el comerciante. El aviso sigue a la vista después de aprobar, también si se eligió mantener el precio de antes.
  - **"Lo que cuesta"** se mide como el precio de venta: el costo de la lista con los descuentos y, si el cálculo de F08 le suma el IVA, con IVA (redondeado hacia arriba al centavo). Comparar con el costo sin IVA del catálogo dejaba pasar precios que pierden el IVA.
  - **`aplicarRevision` rechaza** cualquier precio que no sea un entero de centavos mayor que cero, sin guardar nada. Por eso un cambio con costo en cero ya no ofrece "Pasar a $ 0,00": se mantiene o se escribe el precio.
  - **Descartado:** cambiar también el recargo del producto desde la revisión (sería tocar el catálogo desde otra pantalla); para eso está la ficha del producto.

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
- **Pendiente:** la condición de la fase ("300 productos se revisan en menos de 5 minutos") se mide con una persona y una lista real; dar de alta en el catálogo los productos que no están y editar a mano el precio final en la revisión (hechos el 13/10/2026).

## 12/10/2026 · Fase 3: vinculación con el catálogo (F07)

- **Comparador propio en vez de Fuse.js** (la spec nombraba Fuse.js). Fuse compara letras sueltas y con descripciones de almacén confundía productos de la misma marca. El comparador propio compara palabras: iguales valen 1, abreviatura ("ent" de "entera") 0,8, una letra de diferencia 0,7, y "x50" contra "50" 0,9; sin palabras vacías ("de", "con", "x"). Sin dependencias nuevas. Un índice por palabra evita comparar cada línea con todo el catálogo.
- **Descripción normalizada con unidades unificadas:** "1 lt", "1l" y "1000 cc" → "1000ml"; "1 kg" y "1000 grs" → "1000g"; "x6", "pack 6" y "6 un" → "x6"; "30 mts" → "30m". Se usa también para buscar en el catálogo. La versión 2 de la base recalcula las descripciones ya guardadas.
- **Umbrales** (constantes en `src/domain/vinculacion.ts`): desde 0,8 se sugiere; entre 0,5 y 0,8 es dudosa (se muestran hasta 3 opciones); debajo de 0,5 es nueva. Además, una sugerida tiene que sacarle al menos 0,05 a la segunda opción, y si el contenido o el pack no coinciden (500 g contra 1 kg) nunca se sugiere: queda dudosa.
- **Calibración:** set de 30 productos y 40 líneas escritas como las escriben los proveedores (`tests/fixtures/vinculacion/casos.json`). Resultado: 31 de 31 existentes sugeridas con el producto correcto, ninguna sugerida equivocada, las 9 que el comercio no tiene quedan dudosas o nuevas. **La medida es optimista:** ajustamos la normalización mirando los fallos de este mismo set ("Hellmann's", "3x101g", "mts", "x50"). Hay que medirlo con listas reales.
- **Vínculo recordado por proveedor:** la clave es el código de la línea en minúsculas; si la lista no trae códigos, la descripción normalizada (`desc:…`). Desde la segunda lista, lo confirmado se vincula solo; la prueba con el set da 100% de las que existen (meta: 85%), con y sin códigos.
- **Pantalla de vinculación** después de leer la lista ("Comparar con mi catálogo"): arriba las dudosas (elegir entre opciones o buscar), después las sugeridas (se confirman todas con el botón de guardar; "No es este" para rechazar una), y plegadas las que no están y las ya vinculadas (se pueden cambiar). Sólo se guarda lo que el comerciante confirmó.
- **Pendiente:** dar de alta en el catálogo los productos que no están (hecho el 13/10/2026).

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
