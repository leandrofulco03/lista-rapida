import type { Celda } from '../domain/importe';

/** Lo que devuelve cualquier lector de archivos: las filas tal como están, antes de saber qué columna es qué. */
export interface Tabla {
  filas: Celda[][];
  /** Nombre de la hoja de Excel de donde salió; null en CSV y PDF. */
  hoja: string | null;
}

/** Formatos que se pueden subir: Excel y CSV (F04) y PDF con texto (F05). */
export const EXTENSIONES_LISTA = ['.xlsx', '.xls', '.ods', '.csv', '.txt', '.pdf'] as const;

export class ErrorLectura extends Error {}
