import type { ConfigComercio } from './config';
import type { Centavos, Porcentaje } from './dinero';
import type { Id } from './id';
import { calcularPrecioVenta } from './precio';
import { resolverRecargo } from './recargo';
import { piso } from './revision';
import { periodoDe, sumarDias } from './ventas';
import type { Dia } from './ventas';

/** Fase 9: análisis de ventas y precios (sólo el dueño). */

// ---------------------------------------------------------------------------------------------
// Rango de fechas
// ---------------------------------------------------------------------------------------------

export const RANGOS = [
  { id: '7d', nombre: '7 días' },
  { id: '30d', nombre: '30 días' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mes-anterior', nombre: 'Mes pasado' },
  { id: '90d', nombre: '90 días' },
] as const;
export type RangoAnalisis = (typeof RANGOS)[number]['id'];

export function fechasDeRango(rango: RangoAnalisis, hoy: Dia): { desde: Dia; hasta: Dia } {
  switch (rango) {
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case '90d':
      return { desde: sumarDias(hoy, -89), hasta: hoy };
    case 'mes':
      return { desde: periodoDe('mes', hoy).desde, hasta: hoy };
    case 'mes-anterior': {
      const p = periodoDe('mes', sumarDias(periodoDe('mes', hoy).desde, -1));
      return { desde: p.desde, hasta: p.hasta };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Datos que devuelve la base
// ---------------------------------------------------------------------------------------------

export interface DatosAnalisis {
  ganancia: { ventasConCosto: Centavos; costo: Centavos; ventasSinCosto: Centavos };
  /** Los que más facturaron (hasta 50). Sin id: "Varios" y productos borrados. */
  productos: { productoId: Id | null; descripcion: string; unidades: number; importe: Centavos; ganancia: Centavos | null }[];
  /** null: sin rubro o "Varios". */
  rubros: { rubro: string | null; importe: Centavos }[];
  /** diaSemana: 0 = lunes … 6 = domingo; hora 0–23 (Argentina). */
  horas: { diaSemana: number; hora: number; importe: Centavos; ventas: number }[];
}

// ---------------------------------------------------------------------------------------------
// Ganancia
// ---------------------------------------------------------------------------------------------

export interface Ganancia {
  /** Ventas de las que se sabe el costo. */
  ventas: Centavos;
  ganancia: Centavos;
  /** Ganancia sobre ventas (0,25 = 25%); null sin ventas con costo. */
  margen: number | null;
  /** Ventas sin costo conocido ("Varios", productos con costo 0): no entran en la ganancia. */
  sinCosto: Centavos;
}

export function calcularGanancia(g: DatosAnalisis['ganancia']): Ganancia {
  const ganancia = g.ventasConCosto - g.costo;
  return { ventas: g.ventasConCosto, ganancia, margen: g.ventasConCosto > 0 ? ganancia / g.ventasConCosto : null, sinCosto: g.ventasSinCosto };
}

// ---------------------------------------------------------------------------------------------
// Más vendidos: los primeros y "Otros"
// ---------------------------------------------------------------------------------------------

export interface Porcion {
  nombre: string;
  valor: number;
  /** Parte del total (0–1). */
  parte: number;
  /** true para "Otros". */
  resto: boolean;
}

/**
 * Las `cantidad` mayores y el resto junto en "Otros" (para una torta: pocas porciones se leen; muchas, no).
 * `total` es el total real del período (incluye lo que no está en la lista).
 */
export function principalesYOtros<T>(items: readonly T[], valor: (t: T) => number, nombre: (t: T) => string, total: number, cantidad = 5): Porcion[] {
  const ordenados = [...items].filter((t) => valor(t) > 0).sort((a, b) => valor(b) - valor(a));
  const primeros = ordenados.slice(0, cantidad).map((t) => ({ nombre: nombre(t), valor: valor(t), parte: 0, resto: false }));
  const suma = primeros.reduce((s, p) => s + p.valor, 0);
  const otros = Math.max(0, total - suma);
  const porciones = otros > 0 ? [...primeros, { nombre: 'Otros', valor: otros, parte: 0, resto: true }] : primeros;
  const base = porciones.reduce((s, p) => s + p.valor, 0);
  return porciones.map((p) => ({ ...p, parte: base > 0 ? p.valor / base : 0 }));
}

// ---------------------------------------------------------------------------------------------
// Mapa de día y hora
// ---------------------------------------------------------------------------------------------

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export interface MapaHoras {
  /** Horas que se muestran: de la primera a la última con ventas. */
  horas: number[];
  /** celdas[dia][i] = importe de ese día de la semana a la hora horas[i]. */
  celdas: { importe: Centavos; ventas: number }[][];
  maximo: Centavos;
}

export function armarMapaHoras(horas: DatosAnalisis['horas']): MapaHoras | null {
  if (horas.length === 0) return null;
  const desde = Math.min(...horas.map((h) => h.hora));
  const hasta = Math.max(...horas.map((h) => h.hora));
  const lista = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const celdas = DIAS_CORTOS.map(() => lista.map(() => ({ importe: 0, ventas: 0 })));
  for (const h of horas) celdas[h.diaSemana]![h.hora - desde] = { importe: h.importe, ventas: h.ventas };
  return { horas: lista, celdas, maximo: Math.max(...horas.map((h) => h.importe)) };
}

// ---------------------------------------------------------------------------------------------
// Precios atrasados
// ---------------------------------------------------------------------------------------------

export type MotivoAtraso = 'perdida' | 'bajo-recargo' | 'sin-actualizar';

export interface PrecioAtrasado {
  id: Id;
  descripcion: string;
  precio: Centavos;
  /** El que daría el cálculo con el costo y el recargo de hoy. */
  sugerido: Centavos;
  /** Cuánto le falta al precio para llegar al sugerido (0,1 = 10%); 0 si no le falta. */
  falta: number;
  diasSinActualizar: number;
  motivo: MotivoAtraso;
}

/** Tolerancia: un precio hasta 2% abajo del sugerido no se marca (redondeos, decisiones chicas). */
export const TOLERANCIA_PRECIO = 0.02;
export const DIAS_SIN_ACTUALIZAR = 45;

interface ProductoPrecio {
  id: Id;
  descripcion: string;
  rubroId: Id | null;
  recargoPct: Porcentaje | null;
  ivaPct: Porcentaje;
  costoActual: Centavos;
  precioVentaActual: Centavos;
  actualizado: string;
}

/**
 * Productos cuyo precio quedó atrás: venden a pérdida, quedaron por debajo del recargo, o hace mucho que no se
 * actualizan. Los que no tienen costo no se pueden evaluar y no se listan. Primero los más graves.
 */
export function preciosAtrasados(
  productos: readonly ProductoPrecio[],
  recargosRubro: ReadonlyMap<Id, Porcentaje | null>,
  config: ConfigComercio,
  ahora: Date,
  diasLimite = DIAS_SIN_ACTUALIZAR,
): PrecioAtrasado[] {
  const lista: PrecioAtrasado[] = [];
  for (const p of productos) {
    if (p.costoActual <= 0) continue;
    const recargo = resolverRecargo({
      producto: p.recargoPct,
      rubro: p.rubroId === null ? null : (recargosRubro.get(p.rubroId) ?? null),
      general: config.recargoGeneral,
    }).recargo;
    const datos = { costo: p.costoActual, descuentos: [], ivaPct: p.ivaPct, listaIncluyeIva: false, ventaIncluyeIva: config.ventaIncluyeIva, redondeo: config.redondeo };
    const sugerido = calcularPrecioVenta({ ...datos, recargo }).precio;
    // Lo que cuesta (con IVA si se vende con IVA), como en la revisión (F09): por debajo, se pierde plata.
    const minimo = config.ventaIncluyeIva ? piso(p.costoActual, [], p.ivaPct) : p.costoActual;
    const falta = sugerido > 0 ? Math.max(0, (sugerido - p.precioVentaActual) / sugerido) : 0;
    const dias = Math.max(0, Math.floor((ahora.getTime() - Date.parse(p.actualizado)) / 86_400_000));
    let motivo: MotivoAtraso | null = null;
    if (p.precioVentaActual < minimo) motivo = 'perdida';
    else if (falta > TOLERANCIA_PRECIO) motivo = 'bajo-recargo';
    else if (dias >= diasLimite) motivo = 'sin-actualizar';
    if (motivo) lista.push({ id: p.id, descripcion: p.descripcion, precio: p.precioVentaActual, sugerido, falta, diasSinActualizar: dias, motivo });
  }
  const gravedad: Record<MotivoAtraso, number> = { perdida: 0, 'bajo-recargo': 1, 'sin-actualizar': 2 };
  return lista.sort((a, b) => gravedad[a.motivo] - gravedad[b.motivo] || b.falta - a.falta || b.diasSinActualizar - a.diasSinActualizar);
}
