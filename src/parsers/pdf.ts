import type { Celda } from '../domain/importe';
import { ErrorLectura } from './tabla';
import type { Tabla } from './tabla';

/**
 * F05: lectura de listas en PDF con texto.
 *
 * Un PDF no tiene filas ni columnas: tiene pedacitos de texto con su posición en la página.
 * La tabla se reconstruye en dos pasos: los textos a la misma altura forman un renglón, y las
 * columnas salen de las franjas horizontales que ocupan los textos en los renglones con varios datos.
 * Cada renglón con texto es una fila; las filas se cuentan desde 1 de arriba hacia abajo,
 * página por página.
 */

/** Un texto del PDF con su posición en puntos. `y` crece hacia arriba, como en el PDF. */
export interface TextoPdf {
  texto: string;
  x: number;
  y: number;
  ancho: number;
  /** Alto de la letra. */
  alto: number;
}

/** Un pedazo de renglón: textos pegados que se leen juntos. */
interface Fragmento {
  texto: string;
  desde: number;
  hasta: number;
}

const mediana = (valores: number[]) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)] ?? 0;
};

/** Agrupa los textos de una página en renglones, de arriba hacia abajo. */
function renglonesDePagina(textos: readonly TextoPdf[]): TextoPdf[][] {
  const visibles = textos.filter((t) => t.texto.trim() !== '' && t.alto > 0);
  if (visibles.length === 0) return [];
  const tolerancia = Math.max(1, mediana(visibles.map((t) => t.alto)) * 0.4);
  const orden = [...visibles].sort((a, b) => b.y - a.y || a.x - b.x);
  const renglones: TextoPdf[][] = [];
  let actual: TextoPdf[] = [];
  let yActual = Number.NaN;
  for (const t of orden) {
    if (actual.length > 0 && Math.abs(t.y - yActual) > tolerancia) {
      renglones.push(actual);
      actual = [];
    }
    if (actual.length === 0) yActual = t.y;
    actual.push(t);
  }
  renglones.push(actual);
  return renglones.map((r) => r.sort((a, b) => a.x - b.x));
}

/**
 * Une los textos de un renglón que están pegados (palabras de una misma celda).
 * Un hueco de más de media letra separa celdas: entre palabras hay un espacio, que mide
 * alrededor de un cuarto de la letra; entre columnas suele haber bastante más.
 */
function fragmentosDeRenglon(renglon: readonly TextoPdf[]): Fragmento[] {
  const fragmentos: Fragmento[] = [];
  let ultimoAlto = 0;
  for (const t of renglon) {
    const texto = t.texto.trim();
    const desde = t.x;
    const hasta = t.x + t.ancho;
    const anterior = fragmentos.at(-1);
    const hueco = anterior ? desde - anterior.hasta : Number.POSITIVE_INFINITY;
    const letra = Math.max(t.alto, ultimoAlto);
    if (anterior && hueco < letra * 0.5) {
      const separador = hueco > letra * 0.1 || /\s$/.test(t.texto) || /^\s/.test(t.texto) ? ' ' : '';
      anterior.texto = `${anterior.texto}${separador}${texto}`;
      anterior.hasta = Math.max(anterior.hasta, hasta);
    } else {
      fragmentos.push({ texto, desde, hasta });
    }
    ultimoAlto = t.alto;
  }
  return fragmentos;
}

/** Franjas [desde, hasta) que forman las columnas. */
type Columna = [number, number];

/**
 * Busca las columnas mirando qué franjas horizontales ocupan los textos de los renglones con
 * más de un dato. Un título o un rubro que cruza dos columnas en pocos renglones no las une:
 * una franja cuenta si la ocupa más del 5% de esos renglones.
 */
function detectarFranjas(renglones: readonly Fragmento[][]): Columna[] {
  const tabulares = renglones.filter((r) => r.length > 1);
  const base = tabulares.length > 0 ? tabulares : renglones;
  const todos = base.flat();
  if (todos.length === 0) return [];
  const inicio = Math.floor(Math.min(...todos.map((f) => f.desde)));
  const fin = Math.ceil(Math.max(...todos.map((f) => f.hasta)));
  const cobertura = new Array<number>(fin - inicio + 1).fill(0);
  for (const f of todos) {
    for (let x = Math.floor(f.desde); x < Math.ceil(f.hasta); x++) cobertura[x - inicio]! += 1;
  }
  const minimo = base.length * 0.05;
  const columnas: Columna[] = [];
  let abierta: number | null = null;
  cobertura.forEach((n, i) => {
    if (n > minimo && abierta === null) abierta = i;
    if (n <= minimo && abierta !== null) {
      columnas.push([inicio + abierta, inicio + i]);
      abierta = null;
    }
  });
  if (abierta !== null) columnas.push([inicio + abierta, fin + 1]);
  return columnas;
}

/**
 * La columna donde empieza el fragmento (como en Excel, un texto largo queda en la celda donde
 * arranca); si empieza entre dos columnas, la que más se superpone con él o, si no toca ninguna, la más cercana.
 */
function columnaDe(f: Fragmento, columnas: readonly Columna[]): number {
  const dondeEmpieza = columnas.findIndex(([desde, hasta]) => f.desde >= desde && f.desde < hasta);
  if (dondeEmpieza !== -1) return dondeEmpieza;
  let mejor = 0;
  let mejorPuntaje = Number.NEGATIVE_INFINITY;
  columnas.forEach(([desde, hasta], i) => {
    const superpuesto = Math.min(f.hasta, hasta) - Math.max(f.desde, desde);
    const puntaje = superpuesto > 0 ? superpuesto : -Math.min(Math.abs(f.desde - hasta), Math.abs(desde - f.hasta));
    if (puntaje > mejorPuntaje) {
      mejor = i;
      mejorPuntaje = puntaje;
    }
  });
  return mejor;
}

/** Arma las filas de la tabla a partir de los textos de cada página. */
export function armarFilasPdf(paginas: readonly (readonly TextoPdf[])[]): Celda[][] {
  const renglones = paginas.flatMap((p) => renglonesDePagina(p).map(fragmentosDeRenglon));
  const columnas = detectarFranjas(renglones);
  return renglones.map((fragmentos) => {
    const fila: Celda[] = columnas.map(() => null);
    for (const f of fragmentos) {
      const i = columnaDe(f, columnas);
      fila[i] = fila[i] === null ? f.texto : `${fila[i]} ${f.texto}`;
    }
    return fila;
  });
}

/** Lee los textos con su posición usando pdf.js. Se llama desde el Web Worker de lectura. */
async function textosDelPdf(datos: Uint8Array): Promise<TextoPdf[][]> {
  // Versión "legacy" de pdf.js: funciona en celulares con navegadores de hace algunos años.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // El motor de pdf.js va en un worker propio (ver motorPdf.worker.ts). En las pruebas no hay
  // workers y pdf.js usa el motor que carga pdf.setup.ts.
  const motor =
    typeof Worker === 'undefined'
      ? null
      : new Worker(new URL('../workers/motorPdf.worker.ts', import.meta.url), { type: 'module' });
  const conexion = motor ? pdfjs.PDFWorker.create({ port: motor }) : null;
  const cerrarMotor = () => {
    conexion?.destroy();
    motor?.terminate();
  };
  const carga = pdfjs.getDocument({
    data: datos,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    ...(conexion ? { worker: conexion } : {}),
  });
  let documento;
  try {
    documento = await carga.promise;
  } catch (error) {
    cerrarMotor();
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new ErrorLectura('El PDF tiene contraseña. Pedile al proveedor la lista sin contraseña o en Excel.');
    }
    throw new ErrorLectura('No pudimos abrir el PDF. ¿Está completo?');
  }
  try {
    const paginas: TextoPdf[][] = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const contenido = await pagina.getTextContent();
      const textos: TextoPdf[] = [];
      for (const item of contenido.items) {
        if (!('str' in item)) continue;
        textos.push({
          texto: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          ancho: item.width,
          alto: item.height,
        });
      }
      paginas.push(textos);
      pagina.cleanup();
    }
    return paginas;
  } finally {
    await carga.destroy();
    cerrarMotor();
  }
}

/** F05: lee un PDF con texto y devuelve sus renglones como filas de una tabla. */
export async function leerPdf(datos: Uint8Array): Promise<Tabla> {
  const filas = armarFilasPdf(await textosDelPdf(datos));
  if (filas.length === 0) {
    throw new ErrorLectura(
      'Este PDF no tiene texto: parece una foto o un escaneo. Pedile al proveedor la lista en Excel o en un PDF generado desde la computadora.',
    );
  }
  return { filas, hoja: null };
}
