import type { Centavos } from './dinero';

/**
 * F10: etiquetas para imprimir en hojas A4. Todas las medidas en milímetros, desde la esquina
 * superior izquierda de la hoja.
 */

export const ANCHO_A4 = 210;
export const ALTO_A4 = 297;

export interface FormatoEtiqueta {
  columnas: number;
  filas: number;
  /** Margen de la hoja en los cuatro lados. 0 para hojas de etiquetas autoadhesivas que llegan al borde. */
  margen: number;
}

export const LIMITES_FORMATO = { columnas: [1, 6], filas: [1, 20], margen: [0, 25] } as const;

export const FORMATOS: readonly { id: string; nombre: string; formato: FormatoEtiqueta }[] = [
  { id: '3x8', nombre: '24 por hoja (3 × 8)', formato: { columnas: 3, filas: 8, margen: 10 } },
  { id: '4x10', nombre: '40 por hoja (4 × 10)', formato: { columnas: 4, filas: 10, margen: 10 } },
  { id: '2x5', nombre: '10 grandes (2 × 5)', formato: { columnas: 2, filas: 5, margen: 10 } },
  { id: '3x7', nombre: '21 por hoja (3 × 7)', formato: { columnas: 3, filas: 7, margen: 10 } },
];

export const FORMATO_INICIAL = FORMATOS[0]!.formato;

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Devuelve el error del formato, o null si se puede usar. */
export function validarFormato(f: FormatoEtiqueta): string | null {
  const dentro = (v: number, [min, max]: readonly [number, number]) => Number.isInteger(v) && v >= min && v <= max;
  if (!dentro(f.columnas, LIMITES_FORMATO.columnas)) return 'Las columnas van de 1 a 6.';
  if (!dentro(f.filas, LIMITES_FORMATO.filas)) return 'Las filas van de 1 a 20.';
  if (!dentro(f.margen, LIMITES_FORMATO.margen)) return 'El margen va de 0 a 25 mm.';
  return null;
}

/** Tamaño de cada etiqueta: la hoja menos el margen, repartida en partes iguales. */
export function medidaEtiqueta(f: FormatoEtiqueta): { ancho: number; alto: number } {
  return { ancho: (ANCHO_A4 - 2 * f.margen) / f.columnas, alto: (ALTO_A4 - 2 * f.margen) / f.filas };
}

/** Ubica `cantidad` etiquetas, por filas de izquierda a derecha, en tantas hojas como hagan falta. */
export function ubicarEtiquetas(f: FormatoEtiqueta, cantidad: number): Caja[][] {
  const { ancho, alto } = medidaEtiqueta(f);
  const porHoja = f.columnas * f.filas;
  const hojas: Caja[][] = [];
  for (let i = 0; i < cantidad; i++) {
    if (i % porHoja === 0) hojas.push([]);
    const enHoja = i % porHoja;
    const columna = enHoja % f.columnas;
    const fila = Math.floor(enHoja / f.columnas);
    hojas[hojas.length - 1]!.push({ x: f.margen + columna * ancho, y: f.margen + fila * alto, ancho, alto });
  }
  return hojas;
}

/** Precio para la etiqueta: sin centavos si son cero ("$ 1.580"), con centavos si no ("$ 1.580,50"). */
export function precioEtiqueta(precio: Centavos): string {
  const pesos = Math.floor(precio / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = precio % 100;
  return centavos === 0 ? `$ ${pesos}` : `$ ${pesos},${String(centavos).padStart(2, '0')}`;
}

/** Fecha corta para la etiqueta: 12/10/2026. */
export function fechaEtiqueta(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/**
 * Corta un texto en renglones que entren en `ancho`, según `medir` (ancho de un texto). Si no entra en
 * `maxRenglones`, el último termina en "…". Una palabra más larga que el renglón se corta.
 */
export function partirEnRenglones(texto: string, ancho: number, maxRenglones: number, medir: (t: string) => number): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const renglones: string[] = [];
  let actual = '';
  for (let i = 0; i < palabras.length; i++) {
    let palabra = palabras[i]!;
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (medir(candidato) <= ancho) {
      actual = candidato;
      continue;
    }
    if (actual) {
      renglones.push(actual);
      actual = '';
    }
    while (medir(palabra) > ancho && palabra.length > 1) {
      let corte = palabra.length - 1;
      while (corte > 1 && medir(palabra.slice(0, corte)) > ancho) corte--;
      renglones.push(palabra.slice(0, corte));
      palabra = palabra.slice(corte);
    }
    actual = palabra;
  }
  if (actual) renglones.push(actual);
  if (renglones.length <= maxRenglones) return renglones;
  const visibles = renglones.slice(0, maxRenglones);
  let ultimo = visibles[maxRenglones - 1]!;
  while (ultimo.length > 0 && medir(`${ultimo}…`) > ancho) ultimo = ultimo.slice(0, -1).trimEnd();
  visibles[maxRenglones - 1] = `${ultimo}…`;
  return visibles;
}
