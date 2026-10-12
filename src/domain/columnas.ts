import { leerImporte, detectarFormatoNumeros } from './importe';
import type { Celda } from './importe';
import { normalizarTexto } from './texto';

/**
 * F04/F06: qué columna de la lista es cada dato.
 * La app lo adivina con `detectarColumnas`; el usuario lo corrige y queda guardado en el proveedor.
 */
export type Campo = 'codigo' | 'descripcion' | 'costo' | 'presentacion';

export const CAMPOS: readonly Campo[] = ['codigo', 'descripcion', 'costo', 'presentacion'];

export interface TitulosColumnas {
  codigo: string | null;
  descripcion: string;
  costo: string;
  presentacion: string | null;
}

export interface MapeoColumnas {
  /** Fila de títulos (desde 0); null si la lista no tiene títulos y los datos empiezan arriba de todo. */
  filaEncabezado: number | null;
  /** Índices de columna (desde 0). */
  codigo: number | null;
  descripcion: number;
  costo: number;
  presentacion: number | null;
  /** Títulos normalizados de las columnas elegidas, para reencontrarlas si el proveedor mueve la tabla. */
  titulos: TitulosColumnas | null;
}

export type Confianza = 'alta' | 'baja';

export interface Deteccion {
  /** null si el archivo no tiene nada que parezca una lista de precios. */
  mapeo: MapeoColumnas | null;
  /** 'baja' cuando se adivinó por el contenido o con títulos dudosos: conviene que el usuario mire. */
  confianza: Confianza;
}

/** Cuántas filas de arriba se miran buscando los títulos (logo, datos del proveedor, fecha, etc.). */
export const FILAS_BUSCAR_ENCABEZADO = 30;
const FILAS_MUESTRA = 200;

interface Palabras {
  exactas: readonly string[];
  contiene: readonly string[];
  /** Palabras que indican que la columna no es este dato aunque coincida ("precio sugerido" no es el costo). */
  descartan?: readonly string[];
  /** Palabras que la hacen menos probable sin descartarla. */
  restan?: readonly string[];
}

const PALABRAS: Record<Campo, Palabras> = {
  codigo: {
    exactas: ['codigo', 'cod', 'articulo', 'art', 'cod art', 'codigo art', 'codigo articulo', 'cod articulo', 'cod prod', 'codigo producto', 'sku', 'ref', 'referencia', 'id', 'nro', 'n', 'nro art', 'art nro', 'item', 'interno', 'cod int', 'codigo interno', 'plu'],
    contiene: ['codigo', 'cod ', 'sku'],
    restan: ['barra', 'ean'],
  },
  descripcion: {
    exactas: ['descripcion', 'detalle', 'producto', 'productos', 'articulo', 'articulos', 'nombre', 'desc', 'descripcion del producto', 'descripcion articulo', 'mercaderia'],
    contiene: ['descrip', 'detalle', 'producto', 'articulo', 'nombre'],
    descartan: ['cod', 'codigo', 'precio', 'rubro'],
  },
  costo: {
    exactas: ['precio', 'costo', 'importe', 'valor', 'p lista', 'precio lista', 'lista', 'neto', 'precio unitario', 'p unit', 'precio unit', 'unitario', 'precio neto', 'precio s/iva', 'precio c/iva', 'precio final', 'costo unitario', '$', 'precio $', 'p unitario'],
    contiene: ['precio', 'costo', 'importe', 'neto', 'valor', 'p unit', 'p lista'],
    descartan: ['sugerido', 'pvp', 'publico', 'venta', 'anterior', 'viejo', 'variacion', '%', 'dto', 'descuento', 'cantidad', 'cant'],
    restan: ['bulto', 'caja', 'c/iva', 'con iva', 'final', 'pack', 'iva incl'],
  },
  presentacion: {
    exactas: ['presentacion', 'pres', 'unidad', 'unid', 'contenido', 'envase', 'um', 'u m', 'medida', 'peso', 'tamano', 'formato', 'gramaje'],
    contiene: ['presentacion', 'contenido', 'envase', 'unidad de medida'],
  },
};

/** Qué tan probable es (0 a 3) que un título corresponda a un campo. */
export function puntajeTitulo(campo: Campo, titulo: string): number {
  const texto = normalizarTexto(titulo);
  if (texto === '') return 0;
  const palabras = PALABRAS[campo];
  if (palabras.descartan?.some((p) => contieneTermino(texto, p))) return 0;
  let puntaje = 0;
  if (palabras.exactas.includes(texto)) puntaje = 3;
  else if (palabras.contiene.some((p) => texto.includes(p))) puntaje = 2;
  if (puntaje > 0 && palabras.restan?.some((p) => contieneTermino(texto, p))) puntaje -= 0.5;
  return puntaje;
}

/** Busca un término como palabra entera ("cant" no coincide con "cantidad" salvo que el término sea "cantidad"). */
function contieneTermino(texto: string, termino: string): boolean {
  if (/[^a-z0-9 ]/.test(termino)) return texto.includes(termino);
  return ` ${texto} `.includes(` ${termino} `) || texto.startsWith(`${termino} `) || texto === termino;
}

/** El texto de una celda, recortado ("" si está vacía). */
export function textoCelda(celda: Celda | undefined): string {
  if (celda === null || celda === undefined) return '';
  return String(celda).replace(/\s+/g, ' ').trim();
}

/** true si el título del precio dice si incluye IVA; null si no lo aclara. */
export function ivaDesdeTitulo(titulo: string): boolean | null {
  const texto = normalizarTexto(titulo);
  if (/(c\/ ?iva|con iva|iva incl|iva inc|\bfinal\b)/.test(texto)) return true;
  if (/(s\/ ?iva|sin iva|\+ ?iva|mas iva|\bneto\b)/.test(texto)) return false;
  return null;
}

interface Asignacion {
  columnas: Partial<Record<Campo, number>>;
  puntaje: number;
}

/** Cómo es el contenido de una columna debajo de los títulos. */
interface Contenido {
  precios: number;
  textos: number;
  largoMedio: number;
}

function contenidoColumna(filas: readonly (readonly Celda[])[], columna: number): Contenido {
  const valores = filas.map((f) => f[columna] ?? null).filter((v) => textoCelda(v) !== '');
  if (valores.length === 0) return { precios: 0, textos: 0, largoMedio: 0 };
  const formato = detectarFormatoNumeros(valores);
  const precios = valores.filter((v) => leerImporte(v, formato) !== null).length;
  const largo = valores.reduce<number>((s, v) => s + textoCelda(v).length, 0);
  return { precios: precios / valores.length, textos: 1 - precios / valores.length, largoMedio: largo / valores.length };
}

/** Ajusta el puntaje del título según lo que hay debajo: una descripción no son números, un código no es un texto largo. */
function puntajeConContenido(campo: Campo, puntaje: number, contenido: Contenido): number {
  if (campo === 'costo' && contenido.precios < 0.5) return 0;
  if (campo === 'descripcion' && contenido.textos < 0.5) return Math.max(0, puntaje - 2);
  if (campo === 'codigo' && contenido.largoMedio > 25) return Math.max(0, puntaje - 1);
  return puntaje;
}

/** Asigna a cada campo la columna con más puntaje, sin repetir columnas. */
function asignarTitulos(fila: readonly Celda[], debajo: readonly (readonly Celda[])[]): Asignacion {
  const candidatos: { campo: Campo; columna: number; puntaje: number }[] = [];
  fila.forEach((celda, columna) => {
    const titulo = textoCelda(celda);
    if (titulo === '') return;
    const contenido = contenidoColumna(debajo, columna);
    for (const campo of CAMPOS) {
      const puntaje = puntajeConContenido(campo, puntajeTitulo(campo, titulo), contenido);
      if (puntaje > 0) candidatos.push({ campo, columna, puntaje });
    }
  });
  // Mayor puntaje primero; a igual puntaje gana la columna de más a la izquierda.
  candidatos.sort((a, b) => b.puntaje - a.puntaje || a.columna - b.columna);
  const columnas: Partial<Record<Campo, number>> = {};
  const usadas = new Set<number>();
  let puntaje = 0;
  for (const c of candidatos) {
    if (columnas[c.campo] !== undefined || usadas.has(c.columna)) continue;
    columnas[c.campo] = c.columna;
    usadas.add(c.columna);
    puntaje += c.puntaje;
  }
  return { columnas, puntaje };
}

/** Proporción de celdas no vacías de una columna que se leen como precio. */
function proporcionPrecios(filas: readonly (readonly Celda[])[], columna: number): number {
  const valores = filas.map((f) => f[columna] ?? null).filter((v) => textoCelda(v) !== '');
  if (valores.length === 0) return 0;
  const formato = detectarFormatoNumeros(valores);
  return valores.filter((v) => leerImporte(v, formato) !== null).length / valores.length;
}

/** Arma el mapeo completo y guarda los títulos de las columnas elegidas. */
export function completarMapeo(
  filas: readonly (readonly Celda[])[],
  base: Omit<MapeoColumnas, 'titulos'>,
): MapeoColumnas {
  return { ...base, titulos: leerTitulos(filas, base) };
}

/**
 * Títulos normalizados de las columnas del mapeo. null si no hay fila de títulos
 * o si algún título falta o se repite (en ese caso se reusa el mapeo por posición).
 */
export function leerTitulos(
  filas: readonly (readonly Celda[])[],
  mapeo: Omit<MapeoColumnas, 'titulos'>,
): TitulosColumnas | null {
  if (mapeo.filaEncabezado === null) return null;
  const fila = filas[mapeo.filaEncabezado] ?? [];
  const titulo = (columna: number | null) => (columna === null ? null : normalizarTexto(textoCelda(fila[columna])));
  const titulos = {
    codigo: titulo(mapeo.codigo),
    descripcion: titulo(mapeo.descripcion) ?? '',
    costo: titulo(mapeo.costo) ?? '',
    presentacion: titulo(mapeo.presentacion),
  };
  const elegidos = [titulos.codigo, titulos.descripcion, titulos.costo, titulos.presentacion].filter((t) => t !== null);
  const todos = fila.map((c) => normalizarTexto(textoCelda(c)));
  const unicos = elegidos.every((t) => t !== '' && todos.filter((x) => x === t).length === 1);
  return unicos ? titulos : null;
}

/** Busca la fila de títulos entre las primeras filas. */
function detectarPorTitulos(filas: readonly (readonly Celda[])[]): Deteccion | null {
  let mejor: { fila: number; asignacion: Asignacion } | null = null;
  const limite = Math.min(filas.length, FILAS_BUSCAR_ENCABEZADO);
  for (let i = 0; i < limite; i++) {
    const fila = filas[i] ?? [];
    if (fila.every((c) => textoCelda(c) === '')) continue;
    const asignacion = asignarTitulos(fila, filas.slice(i + 1, i + 1 + FILAS_MUESTRA));
    const { descripcion, costo } = asignacion.columnas;
    if (descripcion === undefined || costo === undefined) continue;
    if (!mejor || asignacion.puntaje > mejor.asignacion.puntaje) mejor = { fila: i, asignacion };
  }
  if (!mejor) return null;
  const { columnas } = mejor.asignacion;
  const mapeo = completarMapeo(filas, {
    filaEncabezado: mejor.fila,
    codigo: columnas.codigo ?? null,
    descripcion: columnas.descripcion!,
    costo: columnas.costo!,
    presentacion: columnas.presentacion ?? null,
  });
  const fila = filas[mejor.fila] ?? [];
  const seguro =
    puntajeTitulo('descripcion', textoCelda(fila[mapeo.descripcion])) >= 2 &&
    puntajeTitulo('costo', textoCelda(fila[mapeo.costo])) >= 2 &&
    proporcionPrecios(filas.slice(mejor.fila + 1, mejor.fila + 1 + FILAS_MUESTRA), mapeo.costo) >= 0.8;
  return { mapeo, confianza: seguro ? 'alta' : 'baja' };
}

const PATRON_PRESENTACION = /\d+([.,]\d+)?\s*(g|gr|grs|kg|kgs|ml|cc|l|lt|lts|cm3|u|un|unid|uni)\b|\bx\s*\d+/i;

/** Sin títulos reconocibles: adivina por lo que hay en cada columna. Siempre con confianza baja. */
function detectarPorContenido(filas: readonly (readonly Celda[])[]): Deteccion {
  const muestra = filas.slice(0, FILAS_MUESTRA);
  const ancho = Math.max(0, ...muestra.map((f) => f.length));
  const stats = Array.from({ length: ancho }, (_, columna) => {
    const valores = muestra.map((f) => f[columna] ?? null).filter((v) => textoCelda(v) !== '');
    const formato = detectarFormatoNumeros(valores);
    const precios = valores.filter((v) => leerImporte(v, formato) !== null).length;
    const textos = valores.filter((v) => typeof v === 'string' && leerImporte(v, formato) === null).map(textoCelda);
    const largoMedio = textos.length ? textos.reduce((s, t) => s + t.length, 0) / textos.length : 0;
    const distintos = new Set(valores.map(textoCelda)).size;
    const presentaciones = textos.filter((t) => PATRON_PRESENTACION.test(t)).length;
    return { columna, llenas: valores.length, precios, textos: textos.length, largoMedio, distintos, presentaciones };
  });
  const maxLlenas = Math.max(0, ...stats.map((s) => s.llenas));
  const relevantes = stats.filter((s) => s.llenas > 0 && s.llenas >= maxLlenas * 0.5);

  const descripcion = relevantes
    .filter((s) => s.textos >= s.llenas * 0.5)
    .sort((a, b) => b.largoMedio - a.largoMedio)[0];
  if (!descripcion) return { mapeo: null, confianza: 'baja' };

  const numericas = relevantes.filter((s) => s.columna !== descripcion.columna && s.precios >= s.llenas * 0.6);
  const costo =
    numericas.filter((s) => s.columna > descripcion.columna).sort((a, b) => a.columna - b.columna)[0] ??
    numericas.sort((a, b) => b.columna - a.columna)[0];
  if (!costo) return { mapeo: null, confianza: 'baja' };

  const codigo = relevantes
    .filter(
      (s) =>
        s.columna < descripcion.columna &&
        s.columna !== costo.columna &&
        s.distintos >= s.llenas * 0.9 &&
        s.largoMedio <= 20,
    )
    .sort((a, b) => b.columna - a.columna)[0];

  const presentacion = relevantes
    .filter(
      (s) =>
        ![descripcion.columna, costo.columna, codigo?.columna].includes(s.columna) &&
        s.presentaciones >= s.llenas * 0.5,
    )
    .sort((a, b) => b.presentaciones - a.presentaciones)[0];

  return {
    mapeo: {
      filaEncabezado: null,
      codigo: codigo?.columna ?? null,
      descripcion: descripcion.columna,
      costo: costo.columna,
      presentacion: presentacion?.columna ?? null,
      titulos: null,
    },
    confianza: 'baja',
  };
}

/** F04: adivina la fila de títulos y qué columna es cada dato. */
export function detectarColumnas(filas: readonly (readonly Celda[])[]): Deteccion {
  return detectarPorTitulos(filas) ?? detectarPorContenido(filas);
}
