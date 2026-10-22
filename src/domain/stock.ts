/**
 * Fase 10: sugerencia de pedido. Con lo vendido en los últimos 28 días se calcula cuánto se vende por día;
 * para cubrir los próximos `dias` días hace falta (venta por día × días). Se pide lo que falta, redondeado
 * hacia arriba a unidades enteras.
 */

export const DIAS_HISTORIA = 28;
export const COBERTURAS = [7, 14, 30] as const;
export type Cobertura = (typeof COBERTURAS)[number];

export interface ParaSugerir {
  productoId: string;
  descripcion: string;
  cantidad: number;
  vendido28: number;
  proveedor: string | null;
}

export interface Sugerencia extends ParaSugerir {
  porDia: number;
  /** Días que alcanza lo que hay (null si no se vende). */
  diasQueAlcanza: number | null;
  pedir: number;
}

/** Productos para pedir, del que se acaba antes al que dura más. */
export function sugerirPedido(productos: readonly ParaSugerir[], dias: number): Sugerencia[] {
  return productos
    .map((p) => {
      const porDia = p.vendido28 / DIAS_HISTORIA;
      const falta = porDia * dias - Math.max(0, p.cantidad);
      // Si ya está en negativo o en cero y no se vende, no se sugiere: no hay con qué calcular cuánto.
      const pedir = falta > 1e-9 ? Math.ceil(falta - 1e-9) : 0;
      return { ...p, porDia, diasQueAlcanza: porDia > 0 ? Math.max(0, p.cantidad) / porDia : null, pedir };
    })
    .filter((s) => s.pedir > 0)
    .sort((a, b) => (a.diasQueAlcanza ?? Infinity) - (b.diasQueAlcanza ?? Infinity) || a.descripcion.localeCompare(b.descripcion, 'es'));
}

/** Agrupa por proveedor; los que no tienen proveedor van al final. */
export function porProveedor<T extends { proveedor: string | null }>(items: readonly T[]): { proveedor: string | null; items: T[] }[] {
  const grupos = new Map<string | null, T[]>();
  for (const i of items) grupos.set(i.proveedor, [...(grupos.get(i.proveedor) ?? []), i]);
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, 'es')))
    .map(([proveedor, items]) => ({ proveedor, items }));
}

/** Texto del pedido para mandarle al proveedor (por WhatsApp, por ejemplo). */
export function textoPedido(comercio: string, items: readonly { descripcion: string; pedir: number }[]): string {
  return [`Hola, te paso el pedido de ${comercio}:`, ...items.map((i) => `- ${i.pedir} × ${i.descripcion}`), '¡Gracias!'].join('\n');
}

/** "Alcanza para 3 días", "Se terminó", "Sin ventas". */
export function textoAlcance(cantidad: number, porDia: number): string {
  if (cantidad <= 0) return 'Se terminó';
  if (porDia <= 0) return 'Sin ventas en 4 semanas';
  const dias = Math.floor(cantidad / porDia);
  if (dias < 1) return 'Alcanza para menos de un día';
  return dias === 1 ? 'Alcanza para 1 día' : `Alcanza para ${dias} días`;
}
