/**
 * Tipos y utilidades de dinero. Todo monto se maneja en centavos enteros
 * y todo porcentaje en centésimos de punto, para no usar decimales nunca.
 */

/** Monto en centavos enteros: $ 1.234,50 = 123450. */
export type Centavos = number;

/** Porcentaje en centésimos de punto: 21% = 2100; 10,5% = 1050. */
export type Porcentaje = number;

/** 100% expresado como Porcentaje. */
export const CIEN_POR_CIENTO: Porcentaje = 10_000;

export function validarCentavos(valor: number, nombre: string): void {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`${nombre} tiene que ser un entero de centavos mayor o igual a 0 (vino ${valor})`);
  }
}

export function validarPorcentaje(valor: number, nombre: string, maximo: Porcentaje): void {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > maximo) {
    throw new RangeError(`${nombre} tiene que ser un entero entre 0 y ${maximo} centésimos de punto (vino ${valor})`);
  }
}

/** Formato de pantalla: 1234550 → "$ 12.345,50". */
export function formatearPesos(monto: Centavos): string {
  if (!Number.isSafeInteger(monto)) {
    throw new RangeError(`El monto tiene que ser un entero de centavos (vino ${monto})`);
  }
  const signo = monto < 0 ? '-' : '';
  const absoluto = Math.abs(monto);
  const pesos = Math.floor(absoluto / 100).toString();
  const centavos = (absoluto % 100).toString().padStart(2, '0');
  const pesosConPuntos = pesos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$ ${pesosConPuntos},${centavos}`;
}

/** Monto para editar en un campo: 123450 → "1.234,50" (sin el signo $). */
export function pesosParaEditar(monto: Centavos): string {
  return formatearPesos(monto).replace(/^\$\s*/, '');
}
