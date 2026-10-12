import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Centavos, Porcentaje } from '../domain/dinero';
import type { ConfigComercio } from '../domain/config';
import type { MapeoColumnas } from '../domain/columnas';

export type { MapeoColumnas };

/**
 * Esquema local (IndexedDB) según el modelo de datos de la spec.
 * Cada cambio de esquema es una versión nueva con su migración; el respaldo (F12) guarda la versión.
 */

/** La configuración es una sola fila con id fijo. */
export const ID_CONFIG = 'comercio';
export interface FilaConfig extends ConfigComercio {
  id: typeof ID_CONFIG;
}

export interface Rubro {
  id: number;
  nombre: string;
  recargoPct: Porcentaje | null;
}

export interface Proveedor {
  id: number;
  nombre: string;
  /** Columnas de su lista, recordadas para el próximo envío (F06). */
  mapeoColumnas: MapeoColumnas | null;
  listaIncluyeIva: boolean;
  /** Descuentos en cascada (desvío de la spec, ver DECISIONS.md). */
  descuentosPct: Porcentaje[];
  creado: string;
}

export interface Producto {
  id: number;
  codigoInterno: string;
  descripcion: string;
  descripcionNormalizada: string;
  rubroId: number | null;
  recargoPct: Porcentaje | null;
  ivaPct: Porcentaje;
  costoActual: Centavos;
  precioVentaActual: Centavos;
  actualizado: string;
}

export interface Vinculo {
  id: number;
  proveedorId: number;
  codigoProveedor: string;
  descripcionProveedor: string;
  productoId: number;
  confirmado: boolean;
}

export type EstadoImportacion = 'borrador' | 'aprobada' | 'descartada';

export interface Importacion {
  id: number;
  proveedorId: number;
  archivoNombre: string;
  fecha: string;
  totalLineas: number;
  vinculadas: number;
  estado: EstadoImportacion;
}

export type EstadoLinea = 'vinculada' | 'dudosa' | 'nueva' | 'ignorada' | 'aprobada';

export interface LineaImportacion {
  id: number;
  importacionId: number;
  filaOrigen: number;
  codigo: string | null;
  descripcion: string;
  costo: Centavos;
  productoId: number | null;
  costoAnterior: Centavos | null;
  precioSugerido: Centavos | null;
  precioFinal: Centavos | null;
  /** Variación en centésimos de punto; puede ser negativa. */
  variacionPct: number | null;
  estado: EstadoLinea;
}

export interface RegistroHistorial {
  id: number;
  productoId: number;
  proveedorId: number;
  fecha: string;
  costo: Centavos;
  precioVenta: Centavos;
}

export class BaseListaRapida extends Dexie {
  config!: EntityTable<FilaConfig, 'id'>;
  rubros!: EntityTable<Rubro, 'id'>;
  proveedores!: EntityTable<Proveedor, 'id'>;
  productos!: EntityTable<Producto, 'id'>;
  vinculos!: EntityTable<Vinculo, 'id'>;
  importaciones!: EntityTable<Importacion, 'id'>;
  lineasImportacion!: EntityTable<LineaImportacion, 'id'>;
  historialPrecios!: EntityTable<RegistroHistorial, 'id'>;

  constructor(nombre = 'lista-rapida') {
    super(nombre);
    this.version(1).stores({
      config: 'id',
      rubros: '++id, nombre',
      proveedores: '++id, nombre',
      productos: '++id, codigoInterno, descripcionNormalizada, rubroId',
      vinculos: '++id, [proveedorId+codigoProveedor], productoId',
      importaciones: '++id, proveedorId, fecha',
      lineasImportacion: '++id, importacionId, estado',
      historialPrecios: '++id, [productoId+fecha], proveedorId',
    });
  }
}

export const TABLAS = [
  'config',
  'rubros',
  'proveedores',
  'productos',
  'vinculos',
  'importaciones',
  'lineasImportacion',
  'historialPrecios',
] as const;
