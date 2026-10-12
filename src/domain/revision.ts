import { CIEN_POR_CIENTO } from './dinero';
import type { Centavos, Porcentaje } from './dinero';
import type { ConfigComercio } from './config';
import type { LineaLista } from './lineaLista';
import { calcularPrecioVenta, RECARGO_MAXIMO } from './precio';
import { resolverRecargo } from './recargo';

/**
 * F09: revisión de los cambios de precio que trae una lista, antes de guardar nada.
 *
 * Controles de seguridad (spec):
 * - Variación mayor al 15% → resaltada arriba.
 * - Variación mayor al 50% o costo en cero → fuera de "aprobar todo"; se aprueba de a una.
 * - Si el costo baja, se sugiere el precio nuevo pero marcado, para decidir si se baja o se mantiene.
 * - Productos del proveedor que no vinieron en esta lista → aviso, sin cambiar nada.
 */

/** Variación desde la que un cambio se resalta: 15%. */
export const VARIACION_RESALTADA: Porcentaje = 1500;
/** Variación desde la que un cambio no entra en "aprobar todo": 50%. */
export const VARIACION_INDIVIDUAL: Porcentaje = 5000;

/** Lo que hace falta del producto del catálogo. */
export interface ProductoRevision {
  id: number;
  descripcion: string;
  rubroId: number | null;
  recargoPct: Porcentaje | null;
  ivaPct: Porcentaje;
  costoActual: Centavos;
  precioVentaActual: Centavos;
}

export interface DatosRevision {
  /** Líneas de la lista con el producto que se eligió en la vinculación (null: sin vincular). */
  lineas: readonly { linea: LineaLista; productoId: number | null }[];
  productos: ReadonlyMap<number, ProductoRevision>;
  /** Recargo de cada rubro que tiene uno propio. */
  recargosRubro: ReadonlyMap<number, Porcentaje | null>;
  /** Productos vinculados antes con este proveedor (para avisar los que no vinieron). */
  vinculadosAntes: ReadonlySet<number>;
  /** Lo que dijo el comerciante al subir la lista; vale si el título del precio no lo aclara. */
  listaIncluyeIva: boolean;
  descuentos: readonly Porcentaje[];
  config: ConfigComercio;
}

export type TipoCambio = 'sube' | 'baja' | 'igual';

export interface Cambio {
  productoId: number;
  descripcion: string;
  linea: LineaLista;
  costoAnterior: Centavos;
  /** Costo nuevo como lo guarda el catálogo: sin IVA y con los descuentos del proveedor. */
  costoNuevo: Centavos;
  precioAnterior: Centavos;
  precioSugerido: Centavos;
  /** Variación del costo en centésimos de punto (puede ser negativa); null si no había costo para comparar. */
  variacion: Porcentaje | null;
  tipo: TipoCambio;
  /** Más del 15%: se muestra arriba y marcado. */
  resaltado: boolean;
  /** Más del 50%, costo en cero o sin costo anterior: no entra en "aprobar todo". */
  individual: boolean;
  /** Por qué se aprueba de a uno, para mostrarlo. */
  motivo: 'variacion' | 'costo-cero' | 'sin-costo-anterior' | null;
}

export interface Revision {
  /** Cambios de costo, de mayor a menor variación (los que no tienen variación, primero). */
  cambios: Cambio[];
  /** Productos cuyo costo no cambió. */
  sinCambios: Cambio[];
  /** Líneas que no quedaron unidas a un producto del catálogo. */
  sinVincular: LineaLista[];
  /** Líneas repetidas: el mismo producto ya vino en una línea anterior de la lista. */
  repetidas: LineaLista[];
  /** Productos vinculados con este proveedor que no vinieron en esta lista. */
  noVinieron: number[];
}

const BASE = BigInt(CIEN_POR_CIENTO);

/** División entera redondeando al más cercano (la mitad, hacia arriba). */
function dividirRedondeando(numerador: bigint, denominador: bigint): bigint {
  return (2n * numerador + denominador) / (2n * denominador);
}

/** Costo de la lista llevado a como lo guarda el catálogo: con los descuentos y sin IVA. */
export function costoNeto(costo: Centavos, descuentos: readonly Porcentaje[], ivaIncluido: boolean, ivaPct: Porcentaje): Centavos {
  let numerador = BigInt(costo);
  let denominador = 1n;
  for (const d of descuentos) {
    numerador *= BASE - BigInt(d);
    denominador *= BASE;
  }
  if (ivaIncluido) {
    numerador *= BASE;
    denominador *= BASE + BigInt(ivaPct);
  }
  return Number(dividirRedondeando(numerador, denominador));
}

/** Variación de `antes` a `despues` en centésimos de punto, redondeada; null si antes es cero. */
export function variacion(antes: Centavos, despues: Centavos): Porcentaje | null {
  if (antes === 0) return null;
  const diferencia = BigInt(despues - antes) * BASE;
  const absoluta = dividirRedondeando(diferencia < 0n ? -diferencia : diferencia, BigInt(antes));
  return Number(diferencia < 0n ? -absoluta : absoluta);
}

export function armarRevision(datos: DatosRevision): Revision {
  const { config } = datos;
  const vistos = new Set<number>();
  const revision: Revision = { cambios: [], sinCambios: [], sinVincular: [], repetidas: [], noVinieron: [] };

  for (const { linea, productoId } of datos.lineas) {
    const producto = productoId === null ? undefined : datos.productos.get(productoId);
    if (!producto) {
      revision.sinVincular.push(linea);
      continue;
    }
    if (vistos.has(producto.id)) {
      revision.repetidas.push(linea);
      continue;
    }
    vistos.add(producto.id);

    const ivaIncluido = linea.ivaIncluido ?? datos.listaIncluyeIva;
    const costoNuevo = costoNeto(linea.costo, datos.descuentos, ivaIncluido, producto.ivaPct);
    const { recargo } = resolverRecargo({
      producto: producto.recargoPct,
      rubro: producto.rubroId === null ? null : datos.recargosRubro.get(producto.rubroId),
      general: config.recargoGeneral,
    });
    const precioSugerido = calcularPrecioVenta({
      costo: linea.costo,
      descuentos: datos.descuentos,
      ivaPct: producto.ivaPct,
      listaIncluyeIva: ivaIncluido,
      ventaIncluyeIva: config.ventaIncluyeIva,
      recargo: Math.min(recargo, RECARGO_MAXIMO),
      redondeo: config.redondeo,
    }).precio;

    const cambio = variacion(producto.costoActual, costoNuevo);
    const tipo: TipoCambio = costoNuevo > producto.costoActual ? 'sube' : costoNuevo < producto.costoActual ? 'baja' : 'igual';
    const motivo =
      costoNuevo === 0
        ? 'costo-cero'
        : cambio === null
          ? 'sin-costo-anterior'
          : Math.abs(cambio) > VARIACION_INDIVIDUAL
            ? 'variacion'
            : null;
    const item: Cambio = {
      productoId: producto.id,
      descripcion: producto.descripcion,
      linea,
      costoAnterior: producto.costoActual,
      costoNuevo,
      precioAnterior: producto.precioVentaActual,
      precioSugerido,
      variacion: cambio,
      tipo,
      resaltado: cambio === null || Math.abs(cambio) > VARIACION_RESALTADA,
      individual: motivo !== null,
      motivo,
    };
    (tipo === 'igual' && costoNuevo !== 0 ? revision.sinCambios : revision.cambios).push(item);
  }

  revision.cambios.sort((a, b) => magnitud(b) - magnitud(a) || a.linea.filaOrigen - b.linea.filaOrigen);
  revision.noVinieron = [...datos.vinculadosAntes].filter((id) => !vistos.has(id) && datos.productos.has(id));
  return revision;
}

const magnitud = (c: Cambio) => (c.variacion === null ? Number.POSITIVE_INFINITY : Math.abs(c.variacion));

/** Lo que se decidió para un cambio: el precio con el que queda, o null si no se cambia nada. */
export type Decision = { precio: Centavos } | null;

/**
 * "Aprobar todo": los cambios que no piden aprobación individual, con el precio sugerido.
 * Las bajas también entran con el precio nuevo; en la pantalla están marcadas para mantener el precio.
 */
export function aprobarTodo(cambios: readonly Cambio[]): Map<number, Decision> {
  return new Map(cambios.filter((c) => !c.individual).map((c) => [c.productoId, { precio: c.precioSugerido }]));
}
