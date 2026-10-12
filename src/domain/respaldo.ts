/**
 * F12: copia de seguridad. Un archivo JSON con todas las tablas y la versión del esquema,
 * para restaurar todo en otro dispositivo.
 */

export const MARCA_RESPALDO = 'lista-rapida';
/** Formato del archivo (no del esquema): cambia sólo si cambia la forma del archivo. */
export const FORMATO_RESPALDO = 1;
/** Cada cuántos días se recuerda hacer una copia. */
export const DIAS_RECORDATORIO = 7;

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
export function leerRespaldo(texto: string, versionActual: number): LecturaRespaldo {
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
    return { ok: false, error: 'La copia se hizo con una versión más nueva de la app. Actualizá la app (recargá la página) y probá de nuevo.' };
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

/** Nombre del archivo: lista-rapida-respaldo-2026-10-12.json (fecha local). */
export function nombreArchivoRespaldo(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${MARCA_RESPALDO}-respaldo-${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}.json`;
}

/** Días enteros desde el último respaldo; null si nunca se hizo. */
export function diasDesdeRespaldo(ultimo: string | null, ahora: Date): number | null {
  if (ultimo === null) return null;
  return Math.max(0, Math.floor((ahora.getTime() - Date.parse(ultimo)) / 86_400_000));
}

/** Se recuerda si hay datos y nunca se hizo una copia, o pasaron 7 días o más. */
export function tocaRecordarRespaldo(ultimo: string | null, hayDatos: boolean, ahora: Date): boolean {
  if (!hayDatos) return false;
  const dias = diasDesdeRespaldo(ultimo, ahora);
  return dias === null || dias >= DIAS_RECORDATORIO;
}
