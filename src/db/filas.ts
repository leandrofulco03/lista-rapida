/**
 * La base usa nombres en snake_case (codigo_interno) y la app en camelCase (codigoInterno).
 * Se convierten sólo las claves de primer nivel: lo que va dentro de una columna JSON
 * (el mapeo de columnas, la regla de redondeo) queda como está.
 */

const aCamel = (clave: string) => clave.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());
const aSnake = (clave: string) => clave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

export function deFila<T>(fila: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(fila).map(([k, v]) => [aCamel(k), v])) as T;
}

export function deFilas<T>(filas: readonly Record<string, unknown>[]): T[] {
  return filas.map((f) => deFila<T>(f));
}

export function aFila(objeto: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(objeto).map(([k, v]) => [aSnake(k), v]));
}
