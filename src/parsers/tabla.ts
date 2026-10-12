import type { Celda } from '../domain/importe';

/** Lo que devuelve cualquier lector de archivos: las filas tal como están, antes de saber qué columna es qué. */
export interface Tabla {
  filas: Celda[][];
  /** Nombre de la hoja de Excel de donde salió; null en CSV. */
  hoja: string | null;
}

/** Formatos que se pueden subir por ahora (F04). El PDF (F05) llega después. */
export const EXTENSIONES_LISTA = ['.xlsx', '.xls', '.ods', '.csv', '.txt'] as const;

export class ErrorLectura extends Error {}
