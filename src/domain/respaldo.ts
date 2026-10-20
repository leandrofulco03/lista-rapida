/**
 * Copia de seguridad de la v1: un archivo JSON con todas las tablas que la v1 guardaba en el navegador.
 * En la v2 los datos viven en la nube; la copia sólo sirve para traer los datos de la versión anterior.
 */

/** Marca interna del archivo. Quedó del primer nombre de la app y no se cambia, para seguir leyendo las copias viejas. */
export const MARCA_RESPALDO = 'lista-rapida';
/** Formato del archivo (no del esquema): cambia sólo si cambia la forma del archivo. */
export const FORMATO_RESPALDO = 1;
/** Última versión del esquema de la base del navegador en la v1: las copias son de esta versión o de una anterior. */
export const VERSION_ESQUEMA_V1 = 2;

export const TABLAS_RESPALDO = [
  'config',
  'rubros',
  'proveedores',
  'productos',
  'vinculos',
  'importaciones',
  'lineasImportacion',
  'historialPrecios',
] as const;
export type TablaRespaldo = (typeof TABLAS_RESPALDO)[number];

export interface Respaldo {
  app: typeof MARCA_RESPALDO;
  formato: typeof FORMATO_RESPALDO;
  /** Versión del esquema de la base con la que se hizo. */
  version: number;
  /** Fecha ISO en que se hizo. */
  fecha: string;
  tablas: Record<TablaRespaldo, Record<string, unknown>[]>;
}

export type LecturaRespaldo = { ok: true; respaldo: Respaldo } | { ok: false; error: string };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Revisa que el texto sea una copia de seguridad de la app, de una versión que esta app sabe leer. */
export function leerRespaldo(texto: string, versionActual: number = VERSION_ESQUEMA_V1): LecturaRespaldo {
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'El archivo no es una copia de seguridad de la app.' };
  }
  if (!esObjeto(dato) || dato.app !== MARCA_RESPALDO || !esObjeto(dato.tablas)) {
    return { ok: false, error: 'El archivo no es una copia de seguridad de la app.' };
  }
  if (dato.formato !== FORMATO_RESPALDO || !Number.isSafeInteger(dato.version) || (dato.version as number) < 1) {
    return { ok: false, error: 'No reconocemos el formato de esta copia de seguridad.' };
  }
  if ((dato.version as number) > versionActual) {
    return { ok: false, error: 'No reconocemos la versión de esta copia de seguridad.' };
  }
  if (typeof dato.fecha !== 'string' || Number.isNaN(Date.parse(dato.fecha))) {
    return { ok: false, error: 'La copia de seguridad está incompleta: no tiene fecha.' };
  }
  const tablas = dato.tablas;
  for (const tabla of TABLAS_RESPALDO) {
    const filas = tablas[tabla];
    if (!Array.isArray(filas) || !filas.every(esObjeto)) {
      return { ok: false, error: 'La copia de seguridad está incompleta o dañada.' };
    }
    const sinId = filas.some((f) => (tabla === 'config' ? typeof f.id !== 'string' : !Number.isSafeInteger(f.id)));
    if (sinId) return { ok: false, error: 'La copia de seguridad está incompleta o dañada.' };
  }
  if ((tablas.config as unknown[]).length !== 1) {
    return { ok: false, error: 'La copia de seguridad no tiene la configuración del comercio.' };
  }
  return { ok: true, respaldo: dato as unknown as Respaldo };
}
