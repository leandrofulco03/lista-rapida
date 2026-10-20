import type { MapeoColumnas } from '../domain/columnas';
import type { Centavos, Porcentaje } from '../domain/dinero';
import type { Id } from '../domain/id';
import type { Backend } from '../nube/backend';

export type { MapeoColumnas };

/**
 * Datos del comercio como los usa la app. Viven en Supabase (supabase/migrations) y se leen y escriben
 * sólo por las funciones de la base; las reglas de acceso las pone la base.
 */

export type Rol = 'admin' | 'empleado';

/** Con quién y en qué comercio se está trabajando. Todas las funciones de datos la reciben. */
export interface Sesion {
  backend: Backend;
  comercioId: Id;
}

export interface Rubro {
  id: Id;
  nombre: string;
  recargoPct: Porcentaje | null;
}

export interface Proveedor {
  id: Id;
  nombre: string;
  /** Columnas de su lista, recordadas para el próximo envío (F06). */
  mapeoColumnas: MapeoColumnas | null;
  listaIncluyeIva: boolean;
  /** Descuentos en cascada (desvío de la spec, ver DECISIONS.md). */
  descuentosPct: Porcentaje[];
  creado: string;
}

export interface Producto {
  id: Id;
  codigoInterno: string;
  /** Código de barras (EAN); null si no tiene. */
  codigoBarras: string | null;
  descripcion: string;
  descripcionNormalizada: string;
  rubroId: Id | null;
  recargoPct: Porcentaje | null;
  ivaPct: Porcentaje;
  costoActual: Centavos;
  precioVentaActual: Centavos;
  actualizado: string;
}

export type EstadoLinea = 'vinculada' | 'dudosa' | 'nueva' | 'ignorada' | 'aprobada';
