/** Identificador de una fila de la base (uuid). Se crea en la base o en el dispositivo (ventas sin conexión). */
export type Id = string;

/** Orden estable entre ids, para desempatar. */
export const compararIds = (a: Id, b: Id): number => (a < b ? -1 : a > b ? 1 : 0);
