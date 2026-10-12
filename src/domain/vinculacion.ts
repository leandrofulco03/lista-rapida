/**
 * F07: vinculación de cada línea de la lista del proveedor con un producto del catálogo.
 *
 * Orden (spec):
 *  1. Código del proveedor ya vinculado antes → vinculada sola.
 *  2. Descripción normalizada parecida → sugerida (similitud alta, se confirma con un toque la primera vez),
 *     dudosa (similitud media, se muestran las 3 mejores opciones) o nueva (similitud baja).
 *  3. Si el contenido no coincide (500 g contra 1 kg), nunca se sugiere sola: queda dudosa.
 */

/** Un producto del catálogo, con lo que hace falta para compararlo. */
export interface ProductoComparable {
  id: number;
  descripcionNormalizada: string;
}

export type EstadoVinculo = 'vinculada' | 'sugerida' | 'dudosa' | 'nueva';

export interface Opcion {
  productoId: number;
  /** Similitud de 0 a 1. */
  similitud: number;
}

export interface ResultadoVinculo {
  estado: EstadoVinculo;
  /** Producto elegido: el vinculado antes o la mejor sugerencia. null en dudosas y nuevas. */
  productoId: number | null;
  /** Hasta 3 mejores opciones, de mayor a menor similitud. */
  opciones: Opcion[];
}

/** Similitud desde la que una línea se sugiere vincular con un toque. Calibrada con el set de prueba. */
export const SIMILITUD_ALTA = 0.8;
/** Similitud desde la que una línea es dudosa (se muestran opciones); por debajo es un producto nuevo. */
export const SIMILITUD_MEDIA = 0.5;
export const OPCIONES_DUDOSA = 3;

const formatear = (n: number) => String(Math.round(n * 1000) / 1000);

/** Palabras que no ayudan a distinguir productos. */
const VACIAS = new Set(['de', 'del', 'con', 'sin', 'el', 'la', 'los', 'las', 'en', 'y', 'a', 'al', 'p', 'por', 'x']);

/**
 * Minúsculas, sin acentos ni signos, y con las unidades unificadas:
 * "1 lt", "1l" y "1000 ml" → "1000ml"; "1 kg" y "1000 grs" → "1000g"; "x6", "x 6", "pack 6" y "6 u" → "x6".
 */
export function normalizarDescripcion(texto: string): string {
  let t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, '');
  t = t.replace(/(\d)\s*x\s*(\d)/g, '$1 x $2'); // 3x101 g → 3 x 101 g
  t = t.replace(/\b(\d{1,3})\.(\d{3})\b(?![.,]\d)/g, '$1$2'); // 1.000 ml → 1000 ml
  t = t.replace(/(\d)[.,](\d)/g, '$1.$2'); // 1,5 → 1.5
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/g, (_, n: string) => `${formatear(Number(n) * 1000)}g`);
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:g|gr|grs|gramos?)\b/g, (_, n: string) => `${formatear(Number(n))}g`);
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:l|lt|lts|ltr|litros?)\b/g, (_, n: string) => `${formatear(Number(n) * 1000)}ml`);
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:ml|cc|cm3)\b/g, (_, n: string) => `${formatear(Number(n))}ml`);
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:m|mt|mts|metros?)\b/g, '$1m');
  // Medidas de ferretería y electricidad: "6 mm" → "6mm", "20 A" → "20a", "220 V" → "220v".
  t = t.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|a|amp|w|v)\b/g, (_, n: string, u: string) => `${n}${u === 'amp' ? 'a' : u}`);
  t = t.replace(/\b(?:pack|pck|caja|bulto)\s*(?:x\s*)?(\d+)\b/g, 'x$1');
  t = t.replace(/\bx\s*(\d+)\b(?!\.\d)/g, 'x$1');
  t = t.replace(/\b(?:x)?(\d+)\s*(?:u|un|uni|unid|unidades|uds)\b/g, 'x$1');
  return t
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Contenido de la descripción ya normalizada: peso o volumen y cantidad por pack. */
export interface Contenido {
  medida: string | null;
  pack: string | null;
}

export function contenidoDe(normalizada: string): Contenido {
  return {
    medida: /\b(\d+(?:\.\d+)?(?:g|ml))\b/.exec(normalizada)?.[1] ?? null,
    pack: /\bx(\d+)\b/.exec(normalizada)?.[1] ?? null,
  };
}

/** true si las dos descripciones dicen contenidos distintos (500 g contra 1 kg; x6 contra x12). */
export function contenidoDistinto(a: Contenido, b: Contenido): boolean {
  return (a.medida !== null && b.medida !== null && a.medida !== b.medida) || (a.pack !== null && b.pack !== null && a.pack !== b.pack);
}

const palabras = (normalizada: string) => normalizada.split(' ').filter((p) => p !== '' && !VACIAS.has(p));

/** true si las palabras difieren en una sola letra (cambiada, de más o de menos). */
function difiereEnUnaLetra(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

/** Parecido entre dos palabras: iguales 1; abreviatura ("ent" de "entera") 0,8; una letra de diferencia 0,7. */
function parecidoPalabras(a: string, b: string): number {
  if (a === b) return 1;
  // "x50" y "50" (cantidad con o sin la x).
  if (/^x?\d+$/.test(a) && /^x?\d+$/.test(b) && a.replace('x', '') === b.replace('x', '')) return 0.9;
  const esNumero = /\d/.test(a) || /\d/.test(b);
  if (esNumero) return 0;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  if (corta.length >= 3 && larga.startsWith(corta)) return 0.8;
  if (corta.length >= 4 && difiereEnUnaLetra(a, b)) return 0.7;
  return 0;
}

function cobertura(desde: readonly string[], hacia: readonly string[]): number {
  return desde.reduce((suma, p) => suma + Math.max(0, ...hacia.map((q) => parecidoPalabras(p, q))), 0);
}

/** Palabras que marcan otra variedad del mismo producto: si una descripción la tiene y la otra no, no son el mismo. */
const VARIEDADES = new Set(['light', 'zero', 'diet', 'descremada', 'descremado', 'semidescremada', 'integral']);

/**
 * true si parecen otra variedad del mismo producto: una tiene "light" o "zero" y la otra no, o a cada una
 * le sobra una palabra que la otra no tiene ("vainilla" contra "frutilla"). Así nunca se sugieren solas.
 * No cuentan las palabras de una o dos letras: suelen ser abreviaturas ("c/palo").
 */
export function variedadDistinta(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = palabras(b);
  const sueltas = (desde: string[], hacia: string[]) => desde.filter((p) => p.length >= 3 && !/\d/.test(p) && hacia.every((q) => parecidoPalabras(p, q) === 0));
  const sa = sueltas(pa, pb);
  const sb = sueltas(pb, pa);
  return [...sa, ...sb].some((p) => VARIEDADES.has(p)) || (sa.length > 0 && sb.length > 0);
}

/** Similitud entre dos descripciones normalizadas, de 0 a 1: cuánto de cada una se encuentra en la otra. */
export function similitud(a: string, b: string): number {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.length === 0 || pb.length === 0) return 0;
  return (cobertura(pa, pb) + cobertura(pb, pa)) / (pa.length + pb.length);
}

/**
 * Índice del catálogo para buscar parecidos rápido: por cada palabra (y sus primeras 3 letras),
 * los productos que la tienen. Así no se compara cada línea con todo el catálogo.
 */
export class IndiceCatalogo {
  private readonly porClave = new Map<string, Set<number>>();
  private readonly productos = new Map<number, { normalizada: string; contenido: Contenido }>();

  constructor(productos: readonly ProductoComparable[]) {
    for (const p of productos) {
      this.productos.set(p.id, { normalizada: p.descripcionNormalizada, contenido: contenidoDe(p.descripcionNormalizada) });
      for (const clave of this.claves(p.descripcionNormalizada)) {
        let ids = this.porClave.get(clave);
        if (!ids) this.porClave.set(clave, (ids = new Set()));
        ids.add(p.id);
      }
    }
  }

  private claves(normalizada: string): string[] {
    return palabras(normalizada)
      .filter((p) => !/\d/.test(p))
      .flatMap((p) => (p.length > 3 ? [p, p.slice(0, 3)] : [p]));
  }

  /** Las mejores opciones para una descripción, de mayor a menor similitud. */
  buscar(normalizada: string, cantidad = OPCIONES_DUDOSA): (Opcion & { contenidoDistinto: boolean; variedadDistinta: boolean })[] {
    const candidatos = new Set<number>();
    for (const clave of this.claves(normalizada)) for (const id of this.porClave.get(clave) ?? []) candidatos.add(id);
    const contenido = contenidoDe(normalizada);
    return [...candidatos]
      .map((id) => {
        const producto = this.productos.get(id)!;
        return {
          productoId: id,
          similitud: similitud(normalizada, producto.normalizada),
          contenidoDistinto: contenidoDistinto(contenido, producto.contenido),
          variedadDistinta: variedadDistinta(normalizada, producto.normalizada),
        };
      })
      .filter((o) => o.similitud > 0)
      .sort((a, b) => b.similitud - a.similitud || a.productoId - b.productoId)
      .slice(0, cantidad);
  }
}

/**
 * Clave con la que se recuerda el vínculo de una línea: su código o, si la lista no trae códigos,
 * su descripción normalizada.
 */
export function claveVinculo(codigo: string | null, descripcion: string, presentacion?: string | null): string {
  const limpio = codigo?.trim().toLowerCase();
  // Sin código, la presentación es parte de la clave: "Látex Alba" de 4 l y de 20 l son productos distintos.
  return limpio ? limpio : `desc:${normalizarDescripcion([descripcion, presentacion].filter(Boolean).join(' '))}`;
}

/**
 * F07: decide con qué producto va una línea.
 * `vinculados`: clave de vínculo → producto, de los vínculos ya confirmados de este proveedor.
 */
export function vincularLinea(
  linea: { codigo: string | null; descripcion: string; presentacion?: string | null },
  vinculados: ReadonlyMap<string, number>,
  indice: IndiceCatalogo,
): ResultadoVinculo {
  const recordado = vinculados.get(claveVinculo(linea.codigo, linea.descripcion, linea.presentacion));
  if (recordado !== undefined) return { estado: 'vinculada', productoId: recordado, opciones: [] };

  const texto = normalizarDescripcion([linea.descripcion, linea.presentacion].filter(Boolean).join(' '));
  const encontradas = indice.buscar(texto);
  const opciones = encontradas
    .filter((o) => o.similitud >= SIMILITUD_MEDIA)
    .map(({ productoId, similitud: s }) => ({ productoId, similitud: s }));
  const mejor = encontradas[0];
  if (!mejor || mejor.similitud < SIMILITUD_MEDIA) return { estado: 'nueva', productoId: null, opciones: [] };
  // Una sugerida tiene que ganarle claro a la segunda opción; si no, que elija el comerciante.
  const segunda = encontradas[1]?.similitud ?? 0;
  if (mejor.similitud >= SIMILITUD_ALTA && !mejor.contenidoDistinto && !mejor.variedadDistinta && mejor.similitud - segunda >= 0.05) {
    return { estado: 'sugerida', productoId: mejor.productoId, opciones };
  }
  return { estado: 'dudosa', productoId: null, opciones };
}
