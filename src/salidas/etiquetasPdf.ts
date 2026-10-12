import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { ALTO_A4, ANCHO_A4, partirEnRenglones, precioEtiqueta, ubicarEtiquetas } from '../domain/etiquetas';
import type { FormatoEtiqueta } from '../domain/etiquetas';
import type { Centavos } from '../domain/dinero';

/** F10: PDF A4 con una etiqueta por producto (descripción, precio y fecha), en tamaño real. */

export interface DatosEtiqueta {
  descripcion: string;
  precio: Centavos;
}

const PT_POR_MM = 72 / 25.4;
const pt = (mm: number) => mm * PT_POR_MM;
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Las fuentes estándar del PDF sólo tienen los caracteres de Europa occidental (acentos, ñ, ü, ¿, ¡ incluidos).
 * Lo demás se cambia por algo parecido o se saca, para que el PDF no falle por un carácter raro de una lista.
 */
export function textoParaPdf(texto: string): string {
  return texto
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generarEtiquetasPdf(etiquetas: readonly DatosEtiqueta[], formato: FormatoEtiqueta, fecha: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Etiquetas de precios');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hojas = ubicarEtiquetas(formato, etiquetas.length);
  let n = 0;
  for (const cajas of hojas) {
    const hoja = pdf.addPage([pt(ANCHO_A4), pt(ALTO_A4)]);
    for (const caja of cajas) {
      dibujarEtiqueta(hoja, etiquetas[n++]!, caja, { normal, negrita }, fecha);
    }
  }
  return pdf.save();
}

type Hoja = ReturnType<PDFDocument['addPage']>;

function dibujarEtiqueta(
  hoja: Hoja,
  etiqueta: DatosEtiqueta,
  caja: { x: number; y: number; ancho: number; alto: number },
  fuentes: { normal: PDFFont; negrita: PDFFont },
  fecha: string,
) {
  const ancho = pt(caja.ancho);
  const alto = pt(caja.alto);
  const izquierda = pt(caja.x);
  const arriba = pt(ALTO_A4 - caja.y); // pdf-lib mide desde abajo
  // Borde finito, para recortar en hoja común.
  hoja.drawRectangle({ x: izquierda, y: arriba - alto, width: ancho, height: alto, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });

  const margen = entre(alto * 0.08, 3, 8);
  const util = ancho - 2 * margen;

  const tamDescripcion = entre(alto * 0.13, 6, 13);
  const renglones = partirEnRenglones(textoParaPdf(etiqueta.descripcion), util, 2, (t) => fuentes.normal.widthOfTextAtSize(t, tamDescripcion));
  renglones.forEach((r, i) => {
    hoja.drawText(r, { x: izquierda + margen, y: arriba - margen - tamDescripcion * (i + 0.85) * 1.1, size: tamDescripcion, font: fuentes.normal });
  });

  const tamFecha = entre(alto * 0.075, 5, 8);
  hoja.drawText(fecha, { x: izquierda + margen, y: arriba - alto + margen * 0.8, size: tamFecha, font: fuentes.normal, color: rgb(0.35, 0.35, 0.35) });

  const precio = precioEtiqueta(etiqueta.precio);
  const espacioPrecio = alto - 2 * margen - tamDescripcion * 2.3 - tamFecha * 1.2;
  let tamPrecio = entre(espacioPrecio * 0.85, 8, 60);
  const anchoPrecio = fuentes.negrita.widthOfTextAtSize(precio, tamPrecio);
  if (anchoPrecio > util) tamPrecio *= util / anchoPrecio;
  const centroPrecio = arriba - margen - tamDescripcion * 2.3 - espacioPrecio / 2;
  hoja.drawText(precio, {
    x: izquierda + ancho - margen - fuentes.negrita.widthOfTextAtSize(precio, tamPrecio),
    y: centroPrecio - tamPrecio * 0.35,
    size: tamPrecio,
    font: fuentes.negrita,
  });
}
