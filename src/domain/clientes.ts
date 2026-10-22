import { formatearPesos } from './dinero';
import type { Centavos } from './dinero';

/**
 * Fase 10: fiado. El saldo es lo que debe el cliente (ventas fiadas menos pagos); negativo, tiene a favor.
 * El límite es opcional: al vender se avisa si la venta lo supera, pero la base no la rechaza (puede venderse sin conexión).
 */

/** "Debe $ 1.500", "Al día", "A favor $ 200". */
export function textoSaldo(saldo: Centavos): string {
  if (saldo > 0) return `Debe ${formatearPesos(saldo)}`;
  if (saldo < 0) return `A favor ${formatearPesos(-saldo)}`;
  return 'Al día';
}

/** Si una venta de `total` supera lo que le queda para fiar (null = sin límite). */
export const superaLimite = (disponible: Centavos | null, total: Centavos): boolean => disponible !== null && total > disponible;

/** Limpia el nombre como lo guarda la base: sin espacios de más, hasta 80 letras. */
export const limpiarNombreCliente = (nombre: string): string => nombre.replace(/\s+/g, ' ').trim().slice(0, 80);

const sinAcentos = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Mismo nombre para la base: sin importar mayúsculas ni espacios de más. */
export const mismoNombre = (a: string, b: string): boolean => limpiarNombreCliente(a).toLowerCase() === limpiarNombreCliente(b).toLowerCase();

/** Busca por palabras del nombre, sin importar mayúsculas ni acentos. */
export function buscarClientes<T extends { nombre: string }>(clientes: readonly T[], texto: string): T[] {
  const palabras = sinAcentos(texto).split(' ').filter(Boolean);
  if (palabras.length === 0) return [...clientes];
  return clientes.filter((c) => {
    const nombre = sinAcentos(c.nombre);
    return palabras.every((p) => nombre.includes(p));
  });
}

/**
 * Número para WhatsApp (wa.me) a partir de lo que se anotó: sólo dígitos, con 54 9 adelante si es un número
 * argentino escrito sin el país (10 dígitos: característica y número, sin 0 ni 15). null si no parece un celular.
 */
export function numeroWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `549${d}`;
  else if (d.length === 12 && d.startsWith('54')) d = `549${d.slice(2)}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Mensaje para recordarle el saldo al cliente. */
export const mensajeSaldo = (comercio: string, cliente: string, saldo: Centavos): string =>
  `Hola ${cliente.split(' ')[0]}, te escribimos de ${comercio}. Tu saldo de fiado es de ${formatearPesos(saldo)}. ¡Gracias!`;

export const enlaceWhatsapp = (numero: string, texto: string): string => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
