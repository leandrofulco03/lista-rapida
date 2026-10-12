import type { Centavos } from './dinero';

/**
 * F04: lectura de precios tal como vienen en las listas de proveedores.
 *
 * En Argentina el punto separa miles y la coma los decimales ("$ 1.234,50"), pero muchos
 * sistemas exportan con punto decimal ("1234.50" o "1,234.50"). Cuando un número es ambiguo
 * ("1.234" o "1,234") decide el formato de la columna, que se deduce con `detectarFormatoNumeros`.
 */
export type FormatoNumeros = 'ar' | 'us';

/** Celda tal como sale del archivo: texto, número (Excel) o vacía. */
export type Celda = string | number | null;

const SIMBOLOS = /\$|ars|u\$s|usd|pesos?/gi;
const ESPACIOS = /[\s  ]+/g;

/** Saca símbolos de moneda y espacios; devuelve null si queda algo que no es número. */
function limpiar(texto: string): string | null {
  const limpio = texto.replace(SIMBOLOS, '').replace(ESPACIOS, '');
  if (!/^\d[\d.,]*$/.test(limpio)) return null;
  return limpio;
}

/** true si los grupos de miles tienen 3 dígitos (el primero, de 1 a 3). */
function gruposDeMilesValidos(entera: string, separador: string): boolean {
  const grupos = entera.split(separador);
  return /^\d{1,3}$/.test(grupos[0] ?? '') && grupos.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Convierte "1234" + "5" en centavos, redondeando al centavo (mitad hacia arriba) si hay más de 2 decimales. */
function aCentavos(entera: string, decimales: string): Centavos | null {
  if (!/^\d+$/.test(entera) || !/^\d*$/.test(decimales)) return null;
  const dos = decimales.slice(0, 2).padEnd(2, '0');
  let centavos = Number(entera) * 100 + Number(dos);
  if (decimales.length > 2 && Number(decimales[2]) >= 5) centavos += 1;
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/**
 * Lee un precio. Devuelve centavos, o null si la celda está vacía, es negativa o no es un número
 * ("Consultar", "s/stock", "-"). Los números de Excel se toman tal cual, redondeados al centavo.
 */
export function leerImporte(valor: Celda, formato: FormatoNumeros = 'ar'): Centavos | null {
  if (valor === null) return null;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return null;
    const centavos = Math.round(valor * 100);
    return Number.isSafeInteger(centavos) ? centavos : null;
  }
  const limpio = limpiar(valor);
  if (limpio === null) return null;

  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');

  // Con los dos separadores, el último es el decimal y el otro separa miles.
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const decimal = ultimoPunto > ultimaComa ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    const corte = Math.max(ultimoPunto, ultimaComa);
    const entera = limpio.slice(0, corte);
    const decimales = limpio.slice(corte + 1);
    if (decimales.includes(miles) || !gruposDeMilesValidos(entera, miles)) return null;
    return aCentavos(entera.split(miles).join(''), decimales);
  }

  const separador = ultimoPunto >= 0 ? '.' : ultimaComa >= 0 ? ',' : null;
  if (separador === null) return aCentavos(limpio, '');

  const partes = limpio.split(separador);
  if (partes.length > 2) {
    // "1.234.567" o "1,234,567": sólo puede ser separador de miles.
    return gruposDeMilesValidos(limpio, separador) ? aCentavos(partes.join(''), '') : null;
  }

  const [entera = '', decimales = ''] = partes;
  const esDecimalDelFormato = (formato === 'ar' && separador === ',') || (formato === 'us' && separador === '.');
  // Un solo separador seguido de 3 dígitos y que no es el decimal del formato: son miles ("1.234" en formato ar).
  if (!esDecimalDelFormato && decimales.length === 3 && gruposDeMilesValidos(limpio, separador)) {
    return aCentavos(entera + decimales, '');
  }
  return aCentavos(entera, decimales);
}

/**
 * Deduce si una columna usa formato argentino ("1.234,50") o con punto decimal ("1234.50").
 * Mira sólo los textos que no son ambiguos; si no hay pistas, asume formato argentino.
 */
export function detectarFormatoNumeros(valores: readonly Celda[]): FormatoNumeros {
  let ar = 0;
  let us = 0;
  for (const valor of valores) {
    if (typeof valor !== 'string') continue;
    const limpio = limpiar(valor);
    if (limpio === null) continue;
    if (/\.\d{3},\d+$/.test(limpio) || /^\d+,\d{1,2}$/.test(limpio)) ar++;
    else if (/,\d{3}\.\d+$/.test(limpio) || /^\d+\.\d{1,2}$/.test(limpio)) us++;
  }
  return us > ar ? 'us' : 'ar';
}
