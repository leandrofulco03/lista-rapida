/**
 * Textos de la ayuda: la guía paso a paso y las preguntas frecuentes.
 * Están separados de la pantalla para poder corregirlos sin tocar el diseño.
 * Los nombres de botones van entre comillas tal como aparecen en la app: si un botón cambia de nombre, se cambia acá.
 */

/** Pantallas a las que la guía puede llevar con un botón. */
export type DestinoAyuda = 'config' | 'catalogo' | 'subir' | 'proveedores' | 'etiquetas' | 'lista-precios' | 'equipo';

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
        pregunta: '¿Cómo la instalo en el celular?',
        respuesta: [
          'En Android (Chrome): tocá los tres puntitos de arriba a la derecha y elegí "Instalar app" o "Agregar a la pantalla principal".',
          'En iPhone (Safari): tocá el botón de compartir (el cuadrado con la flecha) y elegí "Agregar a inicio".',
          'Queda con su ícono como cualquier otra app.',
        ],
      },
      {
        pregunta: '¿Funciona sin internet?',
        respuesta: ['Para ver y guardar tus precios necesita internet: tus datos están en la nube. Leer la lista del proveedor y armar los PDF se hace en tu dispositivo.'],
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
          'Al terminar una revisión tocá "Imprimir sus etiquetas", o entrá a Etiquetas desde el inicio. Elegí el tamaño, sacá o agregá productos y bajá el PDF. Ese PDF se imprime en una hoja A4 común o autoadhesiva.',
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
          'Si deja de trabajar con vos, quitalo desde Equipo y ya no puede entrar.',
        ],
      },
    ],
  },

];
