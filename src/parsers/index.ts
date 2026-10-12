import { leerCsv } from './csv';
import { leerExcel } from './excel';
import { leerPdf } from './pdf';
import { ErrorLectura } from './tabla';
import type { Tabla } from './tabla';

export * from './tabla';

/** Primeros bytes de un .xlsx/.ods (ZIP) y de un .xls viejo (OLE). */
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04];
const FIRMA_OLE = [0xd0, 0xcf, 0x11, 0xe0];
const empiezaCon = (datos: Uint8Array, firma: number[]) => firma.every((b, i) => datos[i] === b);

const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * F04/F05: lee un archivo de lista y devuelve sus filas. Decide por el contenido y no sólo por la extensión,
 * porque a veces llegan Excel renombrados como .csv o archivos sin extensión desde WhatsApp.
 */
export async function leerArchivo(nombre: string, datos: Uint8Array): Promise<Tabla> {
  if (datos.length === 0) throw new ErrorLectura('El archivo está vacío.');
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  const esPdf = empiezaCon(datos, FIRMA_PDF) || (extension === 'pdf' && !empiezaCon(datos, FIRMA_ZIP) && !empiezaCon(datos, FIRMA_OLE));
  const esExcel = empiezaCon(datos, FIRMA_ZIP) || empiezaCon(datos, FIRMA_OLE) || ['xlsx', 'xls', 'ods'].includes(extension);
  const tabla = esPdf ? await leerPdf(datos) : esExcel ? leerExcel(datos) : leerCsv(datos);
  if (tabla.filas.every((f) => f.length === 0)) throw new ErrorLectura('El archivo no tiene datos.');
  return tabla;
}
