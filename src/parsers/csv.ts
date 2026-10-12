import type { Celda } from '../domain/importe';
import type { Tabla } from './tabla';

/**
 * F04: lector de CSV propio. Excel en Windows guarda los CSV con `;` y en Latin-1 (Windows-1252),
 * así que se detectan el separador y la codificación en vez de suponer UTF-8 con comas.
 */

/** UTF-8 si los bytes son UTF-8 válido; si no, Windows-1252. */
export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const SEPARADORES = [';', ',', '\t', '|'] as const;

/** Cuenta separadores fuera de comillas en una línea. */
function contar(linea: string, separador: string): number {
  let n = 0;
  let enComillas = false;
  for (const c of linea) {
    if (c === '"') enComillas = !enComillas;
    else if (c === separador && !enComillas) n++;
  }
  return n;
}

/** Elige el separador que aparece la misma cantidad de veces en más líneas. */
export function detectarSeparador(texto: string): string {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 30);
  let mejor: { separador: string; puntaje: number } = { separador: ';', puntaje: 0 };
  for (const separador of SEPARADORES) {
    const conteos = lineas.map((l) => contar(l, separador)).filter((n) => n > 0);
    if (conteos.length === 0) continue;
    const frecuencias = new Map<number, number>();
    for (const n of conteos) frecuencias.set(n, (frecuencias.get(n) ?? 0) + 1);
    const masComun = Math.max(...frecuencias.values());
    if (masComun > mejor.puntaje) mejor = { separador, puntaje: masComun };
  }
  return mejor.separador;
}

/** Separa el texto en filas y celdas respetando comillas ("Yerba ""La Merced""; 1 kg"). */
export function separarCsv(texto: string, separador: string): Celda[][] {
  const filas: Celda[][] = [];
  let fila: Celda[] = [];
  let celda = '';
  let enComillas = false;
  const cerrarCelda = () => {
    const limpia = celda.trim();
    fila.push(limpia === '' ? null : limpia);
    celda = '';
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === separador) cerrarCelda();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarCelda();
      filas.push(fila);
      fila = [];
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) {
    cerrarCelda();
    filas.push(fila);
  }
  return filas.map((f) => (f.every((c) => c === null) ? [] : f));
}

export function leerCsv(bytes: Uint8Array): Tabla {
  const texto = decodificarTexto(bytes);
  return { filas: separarCsv(texto, detectarSeparador(texto)), hoja: null };
}
