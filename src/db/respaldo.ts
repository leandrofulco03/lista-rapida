import { normalizarConfig } from '../domain/config';
import type { ConfigComercio } from '../domain/config';
import type { Id } from '../domain/id';
import type { Respaldo } from '../domain/respaldo';
import { normalizarDescripcion } from '../domain/vinculacion';
import { aFila } from './filas';
import type { Sesion } from './tipos';

/**
 * Traer los datos de la versión anterior (la v1 guardaba todo en el navegador y hacía copias de seguridad
 * en un archivo JSON). Reemplaza la sección Precios del comercio por lo que trae la copia.
 * Los ids de la v1 eran números; acá se cambian por uuid y se cambian igual en todas las referencias.
 */

type Fila = Record<string, unknown>;

export interface ResumenRespaldo {
  productos: number;
  proveedores: number;
  rubros: number;
}

export function resumirRespaldo(respaldo: Respaldo): ResumenRespaldo {
  return {
    productos: respaldo.tablas.productos.length,
    proveedores: respaldo.tablas.proveedores.length,
    rubros: respaldo.tablas.rubros.length,
  };
}

/** Pasa las tablas de la copia a filas de la base, con uuid en vez de números. */
export function filasDeRespaldo(respaldo: Respaldo, nombreComercio: string): Record<string, unknown> {
  const t = respaldo.tablas;
  const ids = new Map<string, Id>();
  /** Mismo número en la misma tabla → mismo uuid. null queda null; un número que no está, también. */
  const id = (tabla: string, n: unknown, crear = false): Id | null => {
    if (n === null || n === undefined) return null;
    const k = `${tabla}:${String(n)}`;
    let nuevo = ids.get(k);
    if (!nuevo && crear) ids.set(k, (nuevo = crypto.randomUUID()));
    return nuevo ?? null;
  };
  // Primero se crean los ids de todas las filas, así las referencias encuentran el suyo.
  for (const [tabla, filas] of Object.entries(t)) for (const f of filas) id(tabla, f.id, true);

  const sin = (f: Fila, ...campos: string[]) => Object.fromEntries(Object.entries(f).filter(([k]) => !campos.includes(k)));
  const fila = (objeto: object) => aFila(objeto);
  const existe = <T>(v: T | null): v is T => v !== null;

  const rubros = t.rubros.map((r) => fila({ ...sin(r, 'id'), id: id('rubros', r.id) }));
  const proveedores = t.proveedores.map((p) => fila({ ...sin(p, 'id'), id: id('proveedores', p.id) }));
  const productos = t.productos.map((p) =>
    fila({
      ...sin(p, 'id'),
      id: id('productos', p.id),
      codigoBarras: null,
      rubroId: id('rubros', p.rubroId),
      // Una copia de la versión 1 del esquema no tenía las unidades unificadas.
      descripcionNormalizada: normalizarDescripcion(String(p.descripcion ?? '')),
    }),
  );
  const vinculos = t.vinculos
    .map((v) => {
      const proveedorId = id('proveedores', v.proveedorId);
      const productoId = id('productos', v.productoId);
      return proveedorId && productoId ? fila({ ...sin(v, 'id'), id: id('vinculos', v.id), proveedorId, productoId }) : null;
    })
    .filter(existe);
  const importaciones = t.importaciones
    .map((i) => {
      const proveedorId = id('proveedores', i.proveedorId);
      return proveedorId ? fila({ ...sin(i, 'id'), id: id('importaciones', i.id), proveedorId }) : null;
    })
    .filter(existe);
  const importacionesValidas = new Set(importaciones.map((i) => i.id));
  const lineasImportacion = t.lineasImportacion
    .map((l) => {
      const importacionId = id('importaciones', l.importacionId);
      if (!importacionId || !importacionesValidas.has(importacionId)) return null;
      return fila({ ...sin(l, 'id'), id: id('lineasImportacion', l.id), importacionId, productoId: id('productos', l.productoId) });
    })
    .filter(existe);
  const historialPrecios = t.historialPrecios
    .map((h) => {
      const productoId = id('productos', h.productoId);
      return productoId ? fila({ ...sin(h, 'id'), id: id('historialPrecios', h.id), productoId, proveedorId: id('proveedores', h.proveedorId) }) : null;
    })
    .filter(existe);

  const vieja = (t.config[0] ?? {}) as Partial<ConfigComercio>;
  const config = normalizarConfig({
    nombreComercio,
    recargoGeneral: vieja.recargoGeneral as ConfigComercio['recargoGeneral'],
    redondeo: vieja.redondeo as ConfigComercio['redondeo'],
    ventaIncluyeIva: Boolean(vieja.ventaIncluyeIva),
    ivaDefault: vieja.ivaDefault as ConfigComercio['ivaDefault'],
  });

  return {
    config,
    rubros,
    proveedores,
    productos,
    vinculos,
    importaciones,
    lineas_importacion: lineasImportacion,
    historial_precios: historialPrecios,
  };
}

/** Reemplaza la sección Precios del comercio por la copia de la v1 (ya revisada con leerRespaldo). Todo junto. */
export async function importarRespaldo(s: Sesion, respaldo: Respaldo, nombreComercio: string): Promise<void> {
  await s.backend.rpc('importar_respaldo', { c: s.comercioId, datos: filasDeRespaldo(respaldo, nombreComercio) });
}
