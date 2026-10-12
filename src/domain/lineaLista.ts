import type { Centavos } from './dinero';

/**
 * Formato común que devuelven todos los lectores de listas (Excel, CSV y, más adelante, PDF y fotos).
 * El resto de la app sólo conoce este formato, no el archivo de origen.
 */
export interface LineaLista {
  /** Código del producto en la lista del proveedor; null si la lista no trae códigos. */
  codigo: string | null;
  descripcion: string;
  /** Presentación o contenido ("1 kg", "x 12"); null si la lista no la trae aparte. */
  presentacion: string | null;
  costo: Centavos;
  /** true / false si el encabezado del precio lo dice ("c/IVA", "+ IVA"); null si hay que usar lo del proveedor. */
  ivaIncluido: boolean | null;
  /** Número de fila en el archivo, contando desde 1 como lo muestra Excel. */
  filaOrigen: number;
}
