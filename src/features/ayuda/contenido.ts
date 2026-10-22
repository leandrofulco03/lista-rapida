/**
 * Textos de la ayuda: la guía paso a paso y las preguntas frecuentes.
 * Están separados de la pantalla para poder corregirlos sin tocar el diseño.
 * Los nombres de botones van entre comillas tal como aparecen en la app: si un botón cambia de nombre, se cambia acá.
 */

/** Pantallas a las que la guía puede llevar con un botón. */
export type DestinoAyuda = 'config' | 'catalogo' | 'subir' | 'proveedores' | 'etiquetas' | 'lista-precios' | 'equipo' | 'vender' | 'analisis' | 'caja' | 'clientes' | 'stock' | 'gastos';

export interface PasoGuia {
  titulo: string;
  texto: string;
  /** Detalles cortos debajo del texto. */
  detalles?: string[];
  /** Botón que lleva a la pantalla del paso. */
  accion?: { etiqueta: string; destino: DestinoAyuda };
}

export interface Pregunta {
  pregunta: string;
  /** Un párrafo por elemento. */
  respuesta: string[];
}

export interface TemaPreguntas {
  tema: string;
  preguntas: Pregunta[];
}

export const PASOS_GUIA: PasoGuia[] = [
  {
    titulo: 'Configurá tu comercio',
    texto: 'Ya lo hiciste al empezar: el nombre, el recargo general y el redondeo de precios. Lo podés cambiar cuando quieras.',
    detalles: [
      'El recargo general se usa en todos los productos que no tengan uno propio.',
      'En "Opciones avanzadas" elegís si tus precios de venta llevan IVA y qué IVA tienen los productos nuevos.',
    ],
    accion: { etiqueta: 'Ir a Configuración', destino: 'config' },
  },
  {
    titulo: 'Cargá tu catálogo',
    texto: 'El catálogo son los productos que vendés. La app compara cada lista de proveedor contra él, así que hace falta cargarlo una vez.',
    detalles: [
      '"Importar desde Excel": subí tu planilla (Excel, CSV o PDF) con la descripción y, si los tenés, código, rubro, costo, precio de venta e IVA.',
      '"Agregar producto": para cargarlos de a uno.',
      '"Rubros": cada rubro puede tener su propio recargo (por ejemplo, 40% en golosinas y 25% en almacén).',
    ],
    accion: { etiqueta: 'Ir al Catálogo', destino: 'catalogo' },
  },
  {
    titulo: 'Cargá tus ventas',
    texto: 'Tocá "Nueva venta" en el inicio o "Vender" en el menú. Buscá el producto, escribí su código o escanealo; elegí cómo pagó y tocá "Cobrar".',
    detalles: [
      'Los más vendidos aparecen como botones, para cargarlos con un toque.',
      'Si algo no está en el catálogo, usá "Varios" y escribí el importe.',
      'Anda sin internet: la venta queda en el dispositivo y se sube sola cuando vuelve la conexión.',
      'Si no querés cargar cada venta, en Ventas podés anotar el "Total del día".',
    ],
    accion: { etiqueta: 'Cargar una venta', destino: 'vender' },
  },
  {
    titulo: 'Llevá la caja y el fiado',
    texto: 'En Caja abrís el día con el efectivo que hay, anotás lo que sale (un pago a un proveedor, un retiro) y al cerrar contás la plata. La app te dice si sobra o falta.',
    detalles: [
      'Para fiar, elegí "Fiado" al cobrar y el cliente (o escribí uno nuevo).',
      'En Clientes ves cuánto te debe cada uno, anotás lo que te paga y le podés recordar el saldo por WhatsApp.',
      'Tus empleados pueden abrir y cerrar la caja de hoy, pero no ven cuánto debería haber.',
    ],
    accion: { etiqueta: 'Ir a Caja', destino: 'caja' },
  },
  {
    titulo: 'Mirá cómo te va',
    texto: 'El inicio te muestra lo de hoy: cuánto vendiste, en cuántas ventas, el ticket promedio, la semana y las últimas ventas.',
    detalles: [
      'Ventas: el día, la semana o el mes, comparados con el período anterior, y cómo te pagaron.',
      'Análisis: tu ganancia y tu margen, los productos más vendidos, las ventas por rubro y los días y horarios en que más vendés.',
      'En Análisis también ves qué precios conviene revisar y qué productos hace 30 días que no se venden.',
    ],
    accion: { etiqueta: 'Ir a Análisis', destino: 'analisis' },
  },
  {
    titulo: 'Controlá el stock y anotá tus gastos',
    texto: 'En Stock cargás lo que tenés de los productos que querés controlar: se descuentan solos al vender y "Para pedir" te dice cuánto pedir de cada uno.',
    detalles: [
      '"Llegó mercadería" suma lo que entró; "Contar stock" corrige con lo que contaste.',
      'En "Gastos y resultado" anotás los gastos fijos del mes (alquiler, luz, sueldos) y ves cuánto te queda después de pagarlos.',
    ],
    accion: { etiqueta: 'Ir a Stock', destino: 'stock' },
  },
  {
    titulo: 'Subí la lista del proveedor',
    texto: 'Elegí el proveedor (o escribí el nombre de uno nuevo), indicá si los precios de su lista incluyen IVA y elegí el archivo. Después tocá "Leer lista".',
    detalles: [
      'Sirven Excel, CSV y PDF hechos en computadora. Las fotos y los PDF escaneados no se pueden leer.',
      'Subir una lista no cambia ningún precio: primero la revisás.',
    ],
    accion: { etiqueta: 'Subir una lista ahora', destino: 'subir' },
  },
  {
    titulo: 'Controlá lo que se leyó',
    texto: 'La app te muestra cuántos productos leyó. Ella sola busca qué columna es el código, la descripción y el precio; si no está segura, te lo pregunta.',
    detalles: [
      'Si algo quedó mal, tocá "Corregir columnas".',
      'Las columnas se recuerdan para ese proveedor: la próxima lista se lee sola.',
      'Las filas que no son productos (títulos, rubros, totales) se saltean y te las lista con el motivo.',
    ],
  },
  {
    titulo: 'Compará con tu catálogo',
    texto: 'Tocá "Comparar con mi catálogo". La app busca a qué producto tuyo corresponde cada línea de la lista.',
    detalles: [
      'Sugeridos: los que encontró sola. Si uno está mal, tocá "No es este".',
      '¿Con cuál va?: se parecen a más de un producto; elegís vos.',
      'No están en tu catálogo: los podés buscar a mano o "Dar de alta" para sumarlos.',
      'Lo que confirmás queda recordado: desde la segunda lista de ese proveedor, casi todo se vincula solo.',
    ],
  },
  {
    titulo: 'Revisá y aprobá los precios',
    texto: 'Para cada producto que cambió ves el costo de antes y el nuevo, cuánto varió y el precio de venta sugerido. Nada se guarda hasta que tocás "Guardar".',
    detalles: [
      '"Aprobar todo" marca de una vez los cambios normales.',
      'En amarillo: cambió más del 15%. Miralo antes de aprobar.',
      'En rojo: cambió más del 50%, el costo vino en cero o no tenía costo anterior. Se aprueban de a uno.',
      'En azul: el costo bajó. Elegís entre bajar el precio o mantenerlo.',
      '"Otro precio" te deja escribir el precio que quieras.',
    ],
  },
  {
    titulo: 'Imprimí las etiquetas y la lista de precios',
    texto: 'Al guardar, la app te ofrece imprimir las etiquetas sólo de lo que cambió, y bajar la lista de precios para el mostrador o un archivo para el sistema de caja.',
    detalles: [
      'Etiquetas: un PDF en hoja A4, con varios tamaños para elegir.',
      'Lista de precios: en PDF, ordenada por rubro. El CSV se abre con Excel.',
    ],
    accion: { etiqueta: 'Ir a Etiquetas', destino: 'etiquetas' },
  },
  {
    titulo: 'Sumá a tu equipo',
    texto: 'Si alguien te ayuda en el mostrador, generá un código en Equipo y pasáselo. Entra con su propia cuenta y sólo carga ventas.',
    detalles: ['No ve tus costos, tus proveedores ni los números del comercio.', 'El código sirve una vez y dura 7 días.'],
    accion: { etiqueta: 'Ir a Equipo', destino: 'equipo' },
  },
];

export const PREGUNTAS: TemaPreguntas[] = [
  {
    tema: 'Para empezar',
    preguntas: [
      {
        pregunta: '¿Para qué sirve Vendia?',
        respuesta: [
          'Para llevar tu almacén o kiosco: cargás las ventas del día y ves cuánto vendiste, y actualizás tus precios cuando un proveedor te manda una lista nueva.',
          'Con la lista del proveedor, la app la compara con tus productos, calcula los precios nuevos con tu recargo y vos aprobás los cambios. Después imprimís las etiquetas de lo que cambió.',
        ],
      },
      {
        pregunta: '¿Cómo me muevo por la app?',
        respuesta: [
          'Con el menú de la izquierda, que tiene todas las secciones agrupadas: Ventas (Vender, Ventas, Caja, Clientes, Análisis, Gastos y resultado), Precios (Subir lista, Catálogo, Stock, Proveedores, Etiquetas, Lista de precios) y Comercio (Equipo, Configuración, Ayuda).',
          'En el celular el menú está escondido: tocá el botón de las tres rayitas, arriba a la izquierda. Se cierra solo al elegir una sección, o tocando afuera.',
          'Abajo del menú están tu cuenta y el botón "Salir".',
        ],
      },
      {
        pregunta: '¿Qué muestra el inicio?',
        respuesta: [
          'Un resumen de hoy: lo vendido (comparado con ayer), cuántas ventas hiciste, el ticket promedio, lo vendido en la semana, las últimas ventas y cómo te pagaron.',
          'Desde ahí arrancás una venta con "Nueva venta" o subís la lista de un proveedor con "Subí una lista".',
        ],
      },
      {
        pregunta: '¿Cómo la instalo en el celular?',
        respuesta: [
          'En Android (Chrome): tocá los tres puntitos de arriba a la derecha y elegí "Instalar app" o "Agregar a la pantalla principal".',
          'En iPhone (Safari): tocá el botón de compartir (el cuadrado con la flecha) y elegí "Agregar a inicio".',
          'En la computadora (Chrome o Edge): tocá el ícono de instalar, a la derecha de la barra de direcciones.',
          'Queda con su ícono como cualquier otra app.',
        ],
      },
      {
        pregunta: '¿Funciona sin internet?',
        respuesta: [
          'Las ventas, sí: si se corta internet seguís vendiendo, y se suben solas cuando vuelve la conexión.',
          'Para ver los números y cambiar precios necesita internet, porque tus datos están en la nube. Leer la lista del proveedor y armar los PDF se hace en tu dispositivo.',
        ],
      },
      {
        pregunta: '¿Necesito crear una cuenta?',
        respuesta: [
          'Sí: entrás con tu email y una contraseña. Así ves tus datos desde el celular o la computadora, y no se pierden si se rompe el dispositivo.',
          'Cada empleado entra con su propia cuenta.',
        ],
      },
    ],
  },
  {
    tema: 'Listas de proveedores',
    preguntas: [
      {
        pregunta: '¿Qué archivos puedo subir?',
        respuesta: [
          'Excel (.xlsx, .xls), OpenOffice (.ods), CSV o texto (.csv, .txt) y PDF.',
          'El PDF tiene que tener texto, es decir, estar hecho desde una computadora. Si es una foto o un escaneo, la app te avisa: pedile al proveedor la lista en Excel o en un PDF generado desde su sistema. Los PDF con contraseña tampoco se pueden leer.',
        ],
      },
      {
        pregunta: 'La lista se leyó mal o tomó la columna equivocada. ¿Qué hago?',
        respuesta: [
          'En la pantalla que muestra lo leído, tocá "Corregir columnas" y marcá cuál es el código, la descripción y el precio.',
          'Si el proveedor cambió el formato de su lista, entrá a Proveedores, abrí su ficha y tocá "Olvidar columnas": la próxima vez la app las vuelve a buscar.',
        ],
      },
      {
        pregunta: '¿Por qué dice que hay filas salteadas?',
        respuesta: [
          'Son filas de la lista que no son productos: títulos, nombres de rubro, totales, o precios que dicen "Consultar". La app no descarta nada en silencio: te muestra cada una con su motivo para que puedas controlar.',
        ],
      },
      {
        pregunta: 'Mi proveedor me hace descuentos. ¿Dónde los cargo?',
        respuesta: [
          'En Proveedores, abrí la ficha del proveedor y completá "Descuentos". Si son varios, escribilos separados con un más: "10 + 5" es 10% y sobre eso 5% (en total, 14,5%).',
          'Se aplican solos al costo de cada lista de ese proveedor.',
        ],
      },
      {
        pregunta: '¿Cómo sabe la app si la lista viene con IVA o sin IVA?',
        respuesta: [
          'Lo indicás vos al subir la lista, y queda guardado en la ficha del proveedor. Si el título de la columna dice "c/IVA" o "s/IVA", la app usa eso.',
        ],
      },
      {
        pregunta: 'Un producto de la lista no está en mi catálogo.',
        respuesta: [
          'Al comparar aparece en "No están en tu catálogo". Tocá "Dar de alta" para sumarlo (o el botón para dar de alta todos juntos).',
          'Queda en tu catálogo sin precio. En la revisión aparece en rojo y lo aprobás de a uno, con el precio sugerido o con otro.',
        ],
      },
      {
        pregunta: 'La app vinculó una línea con el producto equivocado.',
        respuesta: [
          'En la comparación, tocá "No es este" (en los sugeridos) o abrí "Ya vinculados" y tocá "Cambiar". Elegí el producto correcto y guardá: la próxima lista lo recuerda bien.',
        ],
      },
    ],
  },
  {
    tema: 'Precios',
    preguntas: [
      {
        pregunta: '¿Cómo se calcula el precio de venta?',
        respuesta: [
          'Costo de la lista, menos los descuentos del proveedor, más el IVA, más tu recargo, y al final el redondeo.',
          'Ejemplo: un producto cuesta $ 1.000 + IVA. Con IVA 21% son $ 1.210. Con 30% de recargo, $ 1.573. Redondeado a $ 10, lo venderías a $ 1.580.',
          'En Configuración hay un ejemplo que se actualiza con tus números.',
        ],
      },
      {
        pregunta: '¿Recargo es lo mismo que margen?',
        respuesta: [
          'No. El recargo se calcula sobre el costo: 30% de recargo sobre $ 1.000 da $ 1.300. El margen se calcula sobre el precio de venta. Vendia trabaja con recargo sobre el costo.',
        ],
      },
      {
        pregunta: '¿Qué recargo se usa en cada producto?',
        respuesta: [
          'Primero el recargo propio del producto, si tiene. Si no, el de su rubro. Si el rubro tampoco tiene, el recargo general de Configuración.',
        ],
      },
      {
        pregunta: '¿Cómo funciona el redondeo?',
        respuesta: [
          'Siempre hacia arriba, para no vender por debajo de lo calculado. Podés redondear a $ 10, $ 50 o $ 100, o hacer que los precios terminen en 90 o en 99 ($ 1.234 pasa a $ 1.290 o $ 1.299).',
        ],
      },
      {
        pregunta: 'Subí una lista y mis precios no cambiaron.',
        respuesta: [
          'Los precios sólo cambian cuando los aprobás en la revisión y tocás "Guardar" abajo. Si salís antes, no cambia nada.',
          'No perdés el trabajo: volvé a subir la misma lista y los productos ya van a estar vinculados.',
        ],
      },
      {
        pregunta: '¿Qué significan los colores en la revisión?',
        respuesta: [
          'Amarillo: el costo cambió más del 15%.',
          'Rojo: cambió más del 50%, vino en cero o el producto no tenía costo anterior. Puede ser un error de lectura u otra presentación, así que no entra en "Aprobar todo": se aprueba de a uno.',
          'Azul: el costo bajó. Elegís entre bajar el precio o mantener el de antes.',
        ],
      },
      {
        pregunta: '¿Puedo poner un precio distinto del sugerido?',
        respuesta: [
          'Sí. En la revisión tocá "Otro precio" y escribilo. Si queda por debajo de lo que te cuesta, la app te avisa que vendés a pérdida, pero la decisión es tuya.',
          'También podés cambiar el precio de cualquier producto desde su ficha en el Catálogo.',
        ],
      },
      {
        pregunta: '¿Qué pasa con los productos que no vinieron en la lista?',
        respuesta: ['No se tocan. La revisión te los muestra en "No vinieron en esta lista" para que sepas que ese proveedor no los mandó esta vez.'],
      },
    ],
  },
  {
    tema: 'Etiquetas y lista de precios',
    preguntas: [
      {
        pregunta: '¿Cómo imprimo las etiquetas?',
        respuesta: [
          'Al terminar una revisión tocá "Imprimir sus etiquetas", o entrá a Etiquetas desde el menú. Elegí el tamaño, sacá o agregá productos y bajá el PDF. Ese PDF se imprime en una hoja A4 común o autoadhesiva.',
        ],
      },
      {
        pregunta: 'Las etiquetas salen corridas o cortadas.',
        respuesta: [
          'Al imprimir, elegí "Tamaño real" o "100%", y no "Ajustar a la página".',
          'Si igual no coinciden con tu hoja, abrí "Medidas a mano" y ajustá las columnas, las filas y el margen. Para hojas autoadhesivas que llegan al borde, el margen va en 0.',
        ],
      },
      {
        pregunta: '¿Para qué sirve el CSV para la caja?',
        respuesta: [
          'Es un archivo con código, descripción, rubro y precio de cada producto. Se abre con Excel y sirve para pasar los precios a tu sistema de caja, si tu sistema permite importar una planilla.',
        ],
      },
    ],
  },
  {
    tema: 'Ventas',
    preguntas: [
      {
        pregunta: '¿Cómo cargo una venta?',
        respuesta: [
          'Tocá "Nueva venta". Buscá el producto por nombre, escribí su código o escanealo con la cámara; los más vendidos aparecen como botones. Elegí cómo pagó y tocá "Cobrar".',
          'Si algo no está en el catálogo, usá "Varios" y escribí el importe.',
        ],
      },
      {
        pregunta: '¿Cómo veo lo que vendí en la semana o en el mes?',
        respuesta: [
          'En Ventas, elegí Día, Semana o Mes, y movete con las flechas. Cada número se compara con el período anterior (por ejemplo, "+12%" contra la semana pasada).',
          'Ves la venta total, la cantidad de ventas, el ticket promedio, los artículos vendidos y cómo te pagaron.',
        ],
      },
      {
        pregunta: '¿Qué es el ticket promedio?',
        respuesta: ['Lo que gasta en promedio cada cliente: lo vendido dividido por la cantidad de ventas. Si sube, cada cliente está llevando más.'],
      },
      {
        pregunta: '¿Y si se corta internet?',
        respuesta: ['Podés seguir vendiendo: las ventas quedan guardadas en el dispositivo y se suben solas cuando vuelve la conexión.'],
      },
      {
        pregunta: 'No quiero cargar cada venta. ¿Puedo anotar el total del día?',
        respuesta: [
          'Sí. En Ventas, elegí el día y tocá "Total del día": anotás cuánto entró en efectivo, débito, QR y lo demás. Suma a la venta total.',
          'Esas ventas no cuentan en el ticket promedio ni en los artículos vendidos, porque no tienen detalle.',
        ],
      },
      {
        pregunta: 'Me equivoqué en una venta. ¿Cómo la corrijo?',
        respuesta: [
          'Abrí las ventas del día, tocá la venta y "Anular venta". Después cargala de nuevo bien. La venta anulada queda a la vista, tachada, pero no cuenta.',
          'Un empleado puede anular sus ventas del mismo día; el dueño, cualquiera.',
        ],
      },
    ],
  },
  {
    tema: 'Caja y fiado',
    preguntas: [
      {
        pregunta: '¿Cómo hago el arqueo de caja?',
        respuesta: [
          'Al empezar el día, entrá a Caja y anotá con cuánto efectivo arranca (la app te propone lo que quedó en el último cierre).',
          'Durante el día, anotá lo que sale o entra en efectivo que no es una venta: un pago a un proveedor, un retiro tuyo, cambio que agregaste.',
          'Al cerrar, contá la plata y escribí cuánto hay. La app lo compara con lo que debería haber y te dice si cerró justo, si sobra o si falta.',
        ],
      },
      {
        pregunta: '¿Cómo calcula lo que debería haber en la caja?',
        respuesta: [
          'Lo que había al abrir, más las ventas en efectivo del día, más lo que pagaron en efectivo los clientes de fiado, más las entradas, menos las salidas.',
          'Las ventas con débito, crédito, QR, transferencia o fiado no suman, porque esa plata no está en el cajón.',
        ],
      },
      {
        pregunta: '¿Mis empleados ven cuánto debería haber?',
        respuesta: [
          'No. Pueden abrir la caja de hoy, anotar salidas y cerrarla contando la plata, pero no ven lo esperado ni la diferencia: así cuentan sin saber cuánto "tiene que dar".',
          'Una vez cerrada, sólo el dueño la puede reabrir o corregir.',
        ],
      },
      {
        pregunta: '¿Cómo vendo fiado?',
        respuesta: [
          'Al cobrar, elegí "Fiado" y buscá al cliente. Si es la primera vez, escribí su nombre y tocá "Cliente nuevo". Funciona también sin internet.',
          'Si el cliente tiene un límite y la venta lo pasa, la app te avisa. La venta se puede hacer igual: decidís vos.',
        ],
      },
      {
        pregunta: '¿Cómo anoto lo que me paga un cliente?',
        respuesta: [
          'En Clientes, abrí el cliente y tocá "Registrar pago". Escribí cuánto pagó y cómo. Si pagó en efectivo, suma a la caja del día.',
          'Si te equivocaste, tocá "Anular pago" en sus movimientos.',
          'Con su celular cargado, "Recordar por WhatsApp" le manda un mensaje con lo que debe.',
        ],
      },
      {
        pregunta: '¿Lo fiado cuenta como venta?',
        respuesta: [
          'Sí: lo fiado es una venta del día en que se llevó la mercadería, y aparece en Ventas como "Fiado". Lo que paga después no se cuenta otra vez como venta: baja su deuda.',
        ],
      },
    ],
  },
  {
    tema: 'Stock y gastos',
    preguntas: [
      {
        pregunta: '¿Tengo que cargar el stock de todos los productos?',
        respuesta: [
          'No. Sólo llevan stock los productos que cargás en Stock. Los demás se venden igual, sin control.',
          'Conviene empezar por los que más se venden o los que más te cuesta reponer a tiempo.',
        ],
      },
      {
        pregunta: '¿Cómo se actualiza el stock?',
        respuesta: [
          'Al vender se descuenta solo, y si anulás la venta vuelve. Cuando llega mercadería, tocá "Llegó mercadería" y escribí cuánto entró de cada producto.',
          'Cada tanto contá lo que hay con "Contar stock": la app deja la cantidad que contaste. Si quedó en negativo es porque se vendió más de lo que habías cargado.',
        ],
      },
      {
        pregunta: '¿Cómo calcula cuánto pedir?',
        respuesta: [
          'Con lo que vendiste en las últimas 4 semanas calcula cuánto vendés por día, y lo multiplica por los días que querés cubrir (7, 14 o 30). Te sugiere pedir lo que falta para llegar.',
          'Los productos aparecen agrupados por el proveedor que los trae (según las listas que subiste). Podés copiar el pedido o mandarlo por WhatsApp.',
        ],
      },
      {
        pregunta: '¿Qué es el resultado del mes?',
        respuesta: [
          'Es la ganancia de lo que vendiste en el mes menos los gastos fijos que anotaste. Si es positivo, el negocio dejó plata después de pagar los gastos.',
          'La ganancia sólo cuenta lo vendido con costo cargado: lo de "Varios", el total del día o los productos sin costo no entran, y la pantalla te avisa cuánto quedó afuera.',
        ],
      },
      {
        pregunta: '¿Tengo que cargar los gastos todos los meses?',
        respuesta: [
          'Sí, porque cambian (la luz, por ejemplo). Para no escribir todo de nuevo, tocá "Usar los montos del mes anterior" y corregí lo que cambió.',
          'Si un gasto se terminó, tocá "Ya no lo pago" y deja de aparecer.',
        ],
      },
    ],
  },
  {
    tema: 'Análisis',
    preguntas: [
      {
        pregunta: '¿Qué período muestra el análisis?',
        respuesta: ['El que elijas arriba: 7 días, 30 días, este mes, el mes pasado o 90 días. Vale para todos los números y gráficos de la pantalla.'],
      },
      {
        pregunta: '¿Cómo se calcula la ganancia?',
        respuesta: [
          'Lo que cobraste menos lo que te costó cada producto vendido. Si vendés con IVA incluido, el IVA cuenta como costo, porque no lo recuperás.',
          'El margen es la ganancia sobre lo vendido: con 30% de recargo, el margen da 23,1%.',
          'No entran en la ganancia las ventas de "Varios", los productos sin costo cargado ni lo anotado como total del día: la pantalla te dice cuánto quedó afuera.',
        ],
      },
      {
        pregunta: '¿Qué muestran los gráficos?',
        respuesta: [
          'Ingresos por día: cuánto vendiste cada día del período.',
          'Productos más vendidos: los 5 primeros y el resto en "Otros". Podés verlos por plata o por unidades. Abajo, los 10 que más facturaron, con su ganancia.',
          'Ventas por rubro, y "Cuándo vendés más": un cuadro por día de la semana y hora, más oscuro donde más vendés. Sirve para saber cuándo reforzar el mostrador.',
          'Cada gráfico tiene "Ver los datos" con la tabla de números.',
        ],
      },
      {
        pregunta: '¿Qué son los "Precios para revisar"?',
        respuesta: [
          'Productos cuyo precio quedó atrasado: "Vendés a pérdida" si el precio no cubre el costo, "Por debajo de tu recargo" si está más de 2% abajo de lo que da tu recargo, y "Hace mucho que no cambia" si no se tocó en 45 días.',
          'Corregilos desde el Catálogo o subiendo la lista nueva del proveedor.',
        ],
      },
      {
        pregunta: '¿Y los productos sin ventas?',
        respuesta: ['Son los que no se vendieron en los últimos 30 días: plata quieta en la góndola. Podés hacerles una promo o dejar de reponerlos.'],
      },
      {
        pregunta: '¿Mis empleados ven el análisis?',
        respuesta: ['No. El análisis, los costos y la ganancia los ve sólo el dueño.'],
      },
    ],
  },
  {
    tema: 'Tus datos y tu equipo',
    preguntas: [
      {
        pregunta: '¿Dónde se guardan mis datos? ¿Alguien más los ve?',
        respuesta: [
          'Se guardan en la nube, en tu cuenta. Los ves desde cualquier celular o computadora entrando con tu email y tu contraseña.',
          'Nadie de otro comercio puede verlos. Tus empleados sólo ven los productos y su precio de venta: no ven costos, proveedores ni los números del comercio.',
        ],
      },
      {
        pregunta: '¿Tengo que guardar copias de seguridad?',
        respuesta: ['No. Tus datos quedan guardados en la nube cada vez que cambiás algo. Si se rompe o se pierde el celular, entrás desde otro y está todo.'],
      },
      {
        pregunta: 'Usaba la versión anterior. ¿Cómo traigo mis datos?',
        respuesta: [
          'Si guardaste una copia de seguridad con la versión anterior (un archivo que termina en .json), entrá a Configuración y tocá "Traer datos de la versión anterior".',
          'Se reemplazan el catálogo, los rubros y los proveedores del comercio por los de la copia.',
        ],
      },
      {
        pregunta: '¿Cómo sumo a un empleado?',
        respuesta: [
          'En Equipo, tocá "Generar código" y pasáselo. El empleado crea su cuenta, toca "Tengo un código" y lo escribe. El código sirve una vez y dura 7 días.',
          'El empleado ve un menú corto: Inicio, Vender, Mis ventas (las suyas de hoy) y Caja (la de hoy).',
          'Si deja de trabajar con vos, quitalo desde Equipo y ya no puede entrar.',
        ],
      },
    ],
  },
];
