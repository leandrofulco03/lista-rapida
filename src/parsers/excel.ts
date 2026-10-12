import { read, utils } from 'xlsx';
import type { WorkSheet } from 'xlsx';
import type { Celda } from '../domain/importe';
import { ErrorLectura } from './tabla';
import type { Tabla } from './tabla';

/** Convierte un valor de celda de SheetJS en texto, número o vacío. */
function aCelda(valor: unknown): Celda {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/** Filas de una hoja, alineadas para que la fila 0 sea la fila 1 de Excel y la columna 0 sea la A. */
function filasDeHoja(hoja: WorkSheet): Celda[][] {
  const ref = hoja['!ref'];
  if (!ref) return [];
  const rango = utils.decode_range(ref);
  const crudas = utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null, blankrows: true });
  const vacias: Celda[][] = Array.from({ length: rango.s.r }, () => []);
  const corrimiento: null[] = Array.from({ length: rango.s.c }, () => null);
  const filas = crudas.map((fila) => {
    const celdas = [...corrimiento, ...fila.map(aCelda)];
    return celdas.every((c) => c === null) ? [] : celdas;
  });
  return [...vacias, ...filas];
}

const conDatos = (filas: Celda[][]) => filas.filter((f) => f.length > 0).length;

/**
 * F04: lee Excel (.xlsx, .xls) y OpenDocument (.ods) con SheetJS.
 * Si el libro tiene varias hojas, toma la que tiene más filas con datos.
 */
export function leerExcel(datos: Uint8Array): Tabla {
  let libro;
  try {
    libro = read(datos, { type: 'array', cellDates: false, dense: true });
  } catch {
    throw new ErrorLectura('No pudimos abrir el archivo. ¿Es un Excel válido?');
  }
  let mejor: Tabla = { filas: [], hoja: null };
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = filasDeHoja(hoja);
    if (conDatos(filas) > conDatos(mejor.filas)) mejor = { filas, hoja: nombre };
  }
  return mejor;
}
